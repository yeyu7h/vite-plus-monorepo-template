<script setup lang="ts">
import type { FormSubmitEvent, TableColumn } from '@nuxt/ui'
import { useToast } from '@nuxt/ui/runtime/composables/useToast.js'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { z } from 'zod'

import type { SystemRoleApi } from '@/api/core/system'
import { systemRoleApi } from '@/api/core/system'
import { useConfirm } from '@/composables/useConfirm'
import {
  ALL_STATUS_VALUE,
  buildRolePermissionGroups,
  buildSaveRolePermissions,
  buildServerListQuery,
  getApiErrorMessage,
  getDirectRoleMenuIds,
  getDirectRolePermissions,
  hasRolePermission,
  mergeRolePermissions,
  normalizeRolePermission,
  removeRolePermissions,
  toggleRoleMenuSelection,
} from '@/features/system-management/helpers'
import type { RolePermissionGroup, RolePermissionInput } from '@/features/system-management/helpers'
import { useAdminAccessStore } from '@/stores/access'

definePage({ meta: { title: '角色管理', icon: 'i-lucide-shield-check', order: 10, authority: ['admin'] } })

const accessStore = useAdminAccessStore()
const confirm = useConfirm()
const toast = useToast()
const loading = ref(false)
const saving = ref(false)
const roles = ref<SystemRoleApi.Item[]>([])
const allRoles = ref<SystemRoleApi.Item[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 10
const search = ref('')
const status = ref(ALL_STATUS_VALUE)

const slideoverOpen = ref(false)
const activeEditorTab = ref('basic')
const editingRole = ref<SystemRoleApi.Item | null>(null)
const menuAuthorization = ref<SystemRoleApi.MenuAuthorization | null>(null)
const permissions = ref<SystemRoleApi.PermissionResult | null>(null)
const editorLoading = ref(false)
const selectedMenuIds = ref<string[]>([])
const directPermissions = ref<RolePermissionInput[]>([])
const permissionCatalog = ref<RolePermissionInput[]>([])
const permissionSearch = ref('')
const collapsedPermissionGroups = ref<Set<string>>(new Set())
const copyRoleId = ref('')
const copyingPermissions = ref(false)
const roleForm = reactive({
  id: '',
  name: '',
  description: '',
  status: 'ENABLED' as 'ENABLED' | 'DISABLED',
  parentRoleIds: [] as string[],
})

const roleSchema = z.object({
  id: z
    .string()
    .min(1, '请输入角色 ID')
    .regex(/^[a-z0-9_]+$/, '只能包含小写字母、数字和下划线'),
  name: z.string().min(1, '请输入角色名称').max(64),
})

const columns: TableColumn<SystemRoleApi.Item>[] = [
  { accessorKey: 'name', header: '角色' },
  { accessorKey: 'id', header: '角色 ID' },
  { accessorKey: 'parentRoles', header: '继承自' },
  { accessorKey: 'status', header: '状态' },
  { id: 'actions', header: '操作' },
]

const canEditPermissions = computed(() => permissions.value !== null && !editorLoading.value && editingRole.value?.id !== 'admin' && accessStore.hasPermission('system:role:authorize'))
const inheritedPermissions = computed(() => permissions.value?.permissions.filter(({ inherited }) => inherited).map(normalizeRolePermission) ?? [])
const permissionGroups = computed(() => {
  const keyword = permissionSearch.value.trim().toLowerCase()
  return buildRolePermissionGroups(permissionCatalog.value)
    .map((group) => ({
      ...group,
      permissions:
        keyword && !`${group.label} ${group.id}`.toLowerCase().includes(keyword)
          ? group.permissions.filter(({ resource, action, summary }) => `${resource} ${action} ${summary ?? ''}`.toLowerCase().includes(keyword))
          : group.permissions,
    }))
    .filter(({ permissions: items }) => items.length > 0)
})
const isPermissionSearching = computed(() => Boolean(permissionSearch.value.trim()))
const permissionSearchResults = computed(() => permissionGroups.value.flatMap(({ permissions }) => permissions))
const copyRoleOptions = computed(() => allRoles.value.filter(({ id }) => id !== editingRole.value?.id).map((role) => ({ label: `${role.name} (${role.id})`, value: role.id })))

const parentRoleOptions = computed(() => allRoles.value.filter(({ id }) => id !== editingRole.value?.id).map((role) => ({ label: `${role.name} (${role.id})`, value: role.id })))

async function loadRoles() {
  const requestSessionVersion = accessStore.sessionVersion
  loading.value = true
  try {
    const result = await systemRoleApi.list(
      buildServerListQuery({ page: page.value, pageSize, search: search.value, searchFields: ['id', 'name'], status: status.value, sortField: 'createdAt', sortOrder: 'asc' }),
    )
    roles.value = result.items
    total.value = result.total
  } catch (error) {
    if (accessStore.isLoggedIn && accessStore.sessionVersion === requestSessionVersion) {
      toast.add({ title: '加载角色失败', description: getApiErrorMessage(error), color: 'error' })
    }
  } finally {
    loading.value = false
  }
}

async function loadAllRoles() {
  const requestSessionVersion = accessStore.sessionVersion
  try {
    allRoles.value = (await systemRoleApi.list({ mode: 'off', sorters: JSON.stringify([{ field: 'name', order: 'asc' }]) })).items
  } catch (error) {
    if (accessStore.isLoggedIn && accessStore.sessionVersion === requestSessionVersion) {
      toast.add({ title: '加载角色选项失败', description: getApiErrorMessage(error), color: 'error' })
    }
  }
}

function searchRoles() {
  page.value = 1
  void loadRoles()
}

async function openEditor(role?: SystemRoleApi.Item) {
  const requestSessionVersion = accessStore.sessionVersion
  editingRole.value = role ?? null
  activeEditorTab.value = 'basic'
  Object.assign(roleForm, {
    id: role?.id ?? '',
    name: role?.name ?? '',
    description: role?.description ?? '',
    status: role?.status ?? 'ENABLED',
    parentRoleIds: role?.parentRoles ?? [],
  })
  menuAuthorization.value = null
  permissions.value = null
  selectedMenuIds.value = []
  directPermissions.value = []
  permissionCatalog.value = []
  permissionSearch.value = ''
  collapsedPermissionGroups.value = new Set()
  copyRoleId.value = ''
  slideoverOpen.value = true

  if (role) {
    editorLoading.value = true
    try {
      const [menus, apiPermissions] = await Promise.all([systemRoleApi.getMenus(role.id), systemRoleApi.getPermissions(role.id)])
      menuAuthorization.value = menus
      permissions.value = apiPermissions
      selectedMenuIds.value = [...menus.menuIds]
      permissionCatalog.value = apiPermissions.catalog.map(normalizeRolePermission)
      collapsedPermissionGroups.value = new Set(buildRolePermissionGroups(permissionCatalog.value).map(({ id }) => id))
      directPermissions.value = getDirectRolePermissions(apiPermissions).filter((permission) => hasRolePermission(permissionCatalog.value, permission))
    } catch (error) {
      if (accessStore.isLoggedIn && accessStore.sessionVersion === requestSessionVersion) {
        toast.add({ title: '加载角色授权失败', description: getApiErrorMessage(error), color: 'error' })
      }
    } finally {
      editorLoading.value = false
    }
  }
}

async function saveBasic(event: FormSubmitEvent<z.output<typeof roleSchema>>) {
  saving.value = true
  try {
    const body = {
      name: event.data.name,
      description: roleForm.description || undefined,
      status: roleForm.status,
      parentRoleIds: roleForm.parentRoleIds,
    }
    if (editingRole.value) await systemRoleApi.update(editingRole.value.id, body)
    else await systemRoleApi.create({ id: event.data.id, ...body })
    toast.add({ title: editingRole.value ? '角色已更新' : '角色已创建', color: 'success' })
    slideoverOpen.value = false
    await Promise.all([loadRoles(), loadAllRoles()])
  } catch (error) {
    toast.add({ title: '保存角色失败', description: getApiErrorMessage(error), color: 'error' })
  } finally {
    saving.value = false
  }
}

function toggleMenu(id: string, checked: boolean) {
  if (!menuAuthorization.value) return
  selectedMenuIds.value = toggleRoleMenuSelection(menuAuthorization.value.tree, selectedMenuIds.value, id, checked)
}

async function saveMenuAuthorization() {
  if (!editingRole.value || !menuAuthorization.value) return
  saving.value = true
  try {
    const menuIds = getDirectRoleMenuIds(menuAuthorization.value.tree, selectedMenuIds.value)
    await systemRoleApi.saveMenus(editingRole.value.id, { menuIds })
    const refreshed = await systemRoleApi.getMenus(editingRole.value.id)
    menuAuthorization.value = refreshed
    selectedMenuIds.value = [...refreshed.menuIds]
    toast.add({ title: '菜单授权已保存', description: '授权将在用户下次登录或重新初始化权限后生效。', color: 'success' })
  } catch (error) {
    toast.add({ title: '保存菜单授权失败', description: getApiErrorMessage(error), color: 'error' })
  } finally {
    saving.value = false
  }
}

function permissionSelection(permission: RolePermissionInput) {
  return hasRolePermission([...directPermissions.value, ...inheritedPermissions.value], permission)
}

function permissionGroupSelection(group: RolePermissionGroup): boolean | 'indeterminate' {
  const selected = group.permissions.filter(permissionSelection).length
  if (selected === 0) return false
  if (selected === group.permissions.length) return true
  return 'indeterminate'
}

function setPermissionGroupOpen(groupId: string, open: boolean) {
  const collapsed = new Set(collapsedPermissionGroups.value)
  if (open) collapsed.delete(groupId)
  else collapsed.add(groupId)
  collapsedPermissionGroups.value = collapsed
}

function toggleCatalogPermission(permission: RolePermissionInput, checked: boolean) {
  if (!canEditPermissions.value || hasRolePermission(inheritedPermissions.value, permission)) return
  directPermissions.value = checked ? mergeRolePermissions(directPermissions.value, [permission]) : removeRolePermissions(directPermissions.value, [permission])
}

function togglePermissionGroup(group: RolePermissionGroup, checked: boolean) {
  if (!canEditPermissions.value) return
  directPermissions.value = checked ? mergeRolePermissions(directPermissions.value, group.permissions, inheritedPermissions.value) : removeRolePermissions(directPermissions.value, group.permissions)
}

function selectAllCatalogPermissions() {
  directPermissions.value = mergeRolePermissions(directPermissions.value, permissionCatalog.value, inheritedPermissions.value)
}

function clearDirectPermissions() {
  directPermissions.value = []
}

async function copyRolePermissions() {
  if (!copyRoleId.value || !canEditPermissions.value) return
  copyingPermissions.value = true
  try {
    const source = await systemRoleApi.getPermissions(copyRoleId.value)
    const sourcePermissions = source.permissions.map(normalizeRolePermission).filter((permission) => hasRolePermission(permissionCatalog.value, permission))
    const before = directPermissions.value.length
    directPermissions.value = mergeRolePermissions(directPermissions.value, sourcePermissions, inheritedPermissions.value)
    toast.add({ title: '角色权限已复制', description: `新增 ${directPermissions.value.length - before} 条直接权限，保存后生效。`, color: 'success' })
  } catch (error) {
    toast.add({ title: '复制角色权限失败', description: getApiErrorMessage(error), color: 'error' })
  } finally {
    copyingPermissions.value = false
  }
}

async function saveApiPermissions() {
  if (!editingRole.value || !permissions.value || editorLoading.value) return
  saving.value = true
  try {
    const result = await systemRoleApi.savePermissions(editingRole.value.id, { permissions: buildSaveRolePermissions(directPermissions.value) })
    const refreshed = await systemRoleApi.getPermissions(editingRole.value.id)
    permissions.value = refreshed
    directPermissions.value = getDirectRolePermissions(refreshed)
    toast.add({ title: 'API 权限已保存', description: `当前角色共有 ${result.total} 条直接权限。`, color: 'success' })
  } catch (error) {
    toast.add({ title: '保存 API 权限失败', description: getApiErrorMessage(error), color: 'error' })
  } finally {
    saving.value = false
  }
}

async function requestDelete(role: SystemRoleApi.Item) {
  await confirm({
    title: '删除角色',
    description: `将永久删除角色“${role.name}”。若仍有用户使用它，或其他角色继承它，服务端会拒绝删除。`,
    confirmLabel: '确认删除',
    errorTitle: '删除角色失败',
    formatError: getApiErrorMessage,
    onConfirm: async () => {
      await systemRoleApi.delete(role.id)
      toast.add({ title: '角色已删除', color: 'success' })
      await Promise.all([loadRoles(), loadAllRoles()])
    },
  })
}

watch(status, searchRoles)
watch(page, loadRoles)
onMounted(() => Promise.all([loadRoles(), loadAllRoles()]))
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="flex flex-wrap items-center justify-between gap-3 border-b border-default px-4 py-3">
      <div>
        <h1 class="text-lg font-semibold text-highlighted">角色管理</h1>
        <p class="text-sm text-muted">管理角色继承、菜单授权和 Casbin API 权限。</p>
      </div>
      <UButton v-if="accessStore.hasPermission('system:role:create')" icon="i-lucide-plus" label="新建角色" @click="openEditor()" />
    </div>

    <div class="flex flex-wrap items-center gap-2 border-b border-default px-4 py-3">
      <UInput v-model="search" icon="i-lucide-search" placeholder="搜索角色 ID 或名称" class="w-64" @keyup.enter="searchRoles" />
      <USelect
        v-model="status"
        :items="[
          { label: '全部状态', value: ALL_STATUS_VALUE },
          { label: '启用', value: 'ENABLED' },
          { label: '禁用', value: 'DISABLED' },
        ]"
        class="w-36"
      />
      <UButton label="查询" color="neutral" variant="outline" @click="searchRoles" />
      <UButton icon="i-lucide-refresh-cw" aria-label="刷新" color="neutral" variant="ghost" :loading="loading" @click="loadRoles" />
    </div>

    <UTable :data="roles" :columns="columns" :loading="loading" sticky="header" class="min-h-0 flex-1">
      <template #name-cell="{ row }"
        ><div>
          <div class="font-medium text-default">{{ row.original.name }}</div>
          <div class="max-w-72 truncate text-xs text-muted">{{ row.original.description || '暂无描述' }}</div>
        </div></template
      >
      <template #parentRoles-cell="{ row }"
        ><div class="flex flex-wrap gap-1">
          <UBadge v-for="parent in row.original.parentRoles" :key="parent" :label="parent" color="info" variant="subtle" /><span v-if="!row.original.parentRoles?.length" class="text-muted">—</span>
        </div></template
      >
      <template #status-cell="{ row }"><UBadge :label="row.original.status === 'ENABLED' ? '启用' : '禁用'" :color="row.original.status === 'ENABLED' ? 'success' : 'neutral'" variant="subtle"
      /></template>
      <template #actions-cell="{ row }">
        <div class="flex justify-end gap-1">
          <UButton
            v-if="accessStore.hasPermission('system:role:update') || accessStore.hasPermission('system:role:authorize')"
            icon="i-lucide-pencil"
            label="编辑"
            color="neutral"
            variant="ghost"
            @click="openEditor(row.original)"
          />
          <UButton
            v-if="row.original.id !== 'admin' && accessStore.hasPermission('system:role:delete')"
            icon="i-lucide-trash-2"
            aria-label="删除角色"
            color="error"
            variant="ghost"
            @click="requestDelete(row.original)"
          />
        </div>
      </template>
      <template #empty><UEmpty icon="i-lucide-shield" title="暂无角色" /></template>
    </UTable>

    <div class="flex justify-end border-t border-default px-4 py-3"><UPagination v-model:page="page" :total="total" :items-per-page="pageSize" /></div>
  </div>

  <USlideover
    v-model:open="slideoverOpen"
    :title="editingRole ? `编辑角色 · ${editingRole.name}` : '新建角色'"
    description="角色 ID 创建后不可修改。继承授权和公共菜单为只读。"
    :ui="{ content: 'sm:max-w-2xl' }"
  >
    <template #body>
      <UTabs
        v-model="activeEditorTab"
        :items="[
          { label: '基本信息', value: 'basic', icon: 'i-lucide-info' },
          { label: '菜单授权', value: 'menus', icon: 'i-lucide-list-checks', disabled: !editingRole },
          { label: 'API 权限', value: 'api', icon: 'i-lucide-code-xml', disabled: !editingRole },
        ]"
      >
        <template #content>
          <UForm v-if="activeEditorTab === 'basic'" id="role-form" :schema="roleSchema" :state="roleForm" class="space-y-4 pt-4" @submit="saveBasic">
            <UFormField name="id" label="角色 ID" required><UInput v-model="roleForm.id" :disabled="Boolean(editingRole)" class="w-full" /></UFormField>
            <UFormField name="name" label="角色名称" required><UInput v-model="roleForm.name" class="w-full" /></UFormField>
            <UFormField name="description" label="描述"><UTextarea v-model="roleForm.description" autoresize class="w-full" /></UFormField>
            <UFormField name="status" label="状态"
              ><USelect
                v-model="roleForm.status"
                :disabled="editingRole?.id === 'admin'"
                :items="[
                  { label: '启用', value: 'ENABLED' },
                  { label: '禁用', value: 'DISABLED' },
                ]"
                class="w-full"
            /></UFormField>
            <UFormField name="parentRoleIds" label="上级角色" description="上级角色的菜单与 API 权限会被继承。"
              ><USelectMenu v-model="roleForm.parentRoleIds" multiple value-key="value" :disabled="editingRole?.id === 'admin'" :items="parentRoleOptions" class="w-full"
            /></UFormField>
          </UForm>

          <div v-else-if="activeEditorTab === 'menus'" class="pt-4">
            <USkeleton v-if="editorLoading" class="h-48 w-full" />
            <template v-else-if="menuAuthorization">
              <UAlert v-if="menuAuthorization.readOnly" title="管理员授权受保护" description="admin 始终拥有全部受限菜单，不能修改其授权。" color="warning" variant="subtle" class="mb-4" />
              <MenuAuthorizationTree :items="menuAuthorization.tree" :selected-ids="selectedMenuIds" @toggle="toggleMenu" />
            </template>
            <UEmpty v-else icon="i-lucide-list-x" title="无法加载菜单授权" />
          </div>

          <div v-else class="pt-4">
            <USkeleton v-if="editorLoading" class="h-48 w-full" />
            <UEmpty v-else-if="!permissions" icon="i-lucide-code-xml" title="无法加载 API 权限" />
            <template v-else>
              <UAlert v-if="editingRole?.id === 'admin'" title="管理员授权受保护" description="admin 的 API 权限不能修改。" color="warning" variant="subtle" class="mb-4" />
              <UAlert
                v-else-if="!accessStore.hasPermission('system:role:authorize')"
                title="只读权限"
                description="你可以查看直接和继承的 API 权限，但没有角色授权操作权限。"
                color="info"
                variant="subtle"
                class="mb-4"
              />
              <UAlert v-else title="全量保存直接权限" description="新增和移除只影响当前角色的直接权限；从上级角色继承的规则保持只读。" color="info" variant="subtle" class="mb-4" />

              <div v-if="canEditPermissions" class="mb-4 space-y-3 rounded-lg border border-default p-3">
                <div class="text-sm font-medium text-default">快捷授权</div>
                <div class="flex flex-wrap items-center gap-2">
                  <USelectMenu v-model="copyRoleId" :items="copyRoleOptions" value-key="value" placeholder="选择一个角色作为模板" class="min-w-56 flex-1" />
                  <UButton label="复制权限" icon="i-lucide-copy" color="neutral" variant="outline" :disabled="!copyRoleId" :loading="copyingPermissions" @click="copyRolePermissions" />
                  <UButton label="全选接口目录" icon="i-lucide-list-checks" color="neutral" variant="outline" @click="selectAllCatalogPermissions" />
                  <UButton label="清空直接权限" icon="i-lucide-eraser" color="neutral" variant="ghost" @click="clearDirectPermissions" />
                </div>
              </div>

              <div class="space-y-3">
                <UInput v-model="permissionSearch" icon="i-lucide-search" placeholder="搜索资源路径或 HTTP 方法" class="w-full" />
                <div v-if="isPermissionSearching && permissionSearchResults.length > 0" class="overflow-hidden rounded-lg border border-default">
                  <div class="divide-y divide-default">
                    <div v-for="permission in permissionSearchResults" :key="`${permission.resource}:${permission.action}`" class="flex items-center gap-3 px-3 py-2.5">
                      <UCheckbox
                        :model-value="permissionSelection(permission)"
                        :disabled="!canEditPermissions || hasRolePermission(inheritedPermissions, permission)"
                        :aria-label="`${permission.action} ${permission.resource}`"
                        @update:model-value="toggleCatalogPermission(permission, Boolean($event))"
                      />
                      <UBadge :label="permission.action" color="neutral" variant="subtle" class="w-14 shrink-0 justify-center p-1 text-xs" />
                      <div class="min-w-0 flex-1">
                        <code class="block truncate text-xs text-default">{{ permission.resource }}</code>
                        <p v-if="permission.summary" :title="permission.summary" class="truncate text-[11px] leading-4 text-muted">{{ permission.summary }}</p>
                      </div>
                      <UBadge v-if="hasRolePermission(inheritedPermissions, permission)" label="继承" color="info" variant="subtle" class="shrink-0" />
                    </div>
                  </div>
                </div>
                <template v-else>
                  <div v-for="group in permissionGroups" :key="group.id" class="relative">
                    <div class="absolute top-0 left-3 z-10 flex h-11 items-center">
                      <UCheckbox
                        :model-value="permissionGroupSelection(group)"
                        :disabled="!canEditPermissions"
                        :aria-label="`选择${group.label}全部接口`"
                        @update:model-value="togglePermissionGroup(group, Boolean($event))"
                      />
                    </div>
                    <UCollapsible :open="!collapsedPermissionGroups.has(group.id)" class="overflow-hidden rounded-lg border border-default" @update:open="setPermissionGroupOpen(group.id, $event)">
                      <template #default="{ open }">
                        <button type="button" class="flex h-11 w-full min-w-0 items-center gap-2 bg-elevated pr-3 pl-10 text-left">
                          <span class="shrink-0 text-sm font-medium text-default">{{ group.label }}</span>
                          <code class="min-w-0 truncate text-xs text-muted">{{ group.id }}</code>
                          <UBadge :label="`${group.permissions.filter(permissionSelection).length}/${group.permissions.length}`" color="neutral" variant="subtle" class="ml-auto shrink-0" />
                          <UIcon name="i-lucide-chevron-right" class="size-4 shrink-0 text-muted transition-transform duration-200" :class="open ? 'rotate-90' : 'rotate-0'" />
                        </button>
                      </template>
                      <template #content>
                        <div class="divide-y divide-default">
                          <div v-for="permission in group.permissions" :key="`${permission.resource}:${permission.action}`" class="flex items-center gap-3 px-3 py-2.5">
                            <UCheckbox
                              :model-value="permissionSelection(permission)"
                              :disabled="!canEditPermissions || hasRolePermission(inheritedPermissions, permission)"
                              :aria-label="`${permission.action} ${permission.resource}`"
                              @update:model-value="toggleCatalogPermission(permission, Boolean($event))"
                            />
                            <UBadge :label="permission.action" color="neutral" variant="subtle" class="w-14 shrink-0 justify-center p-1 text-xs" />
                            <div class="min-w-0 flex-1">
                              <code class="block truncate text-xs text-default">{{ permission.resource }}</code>
                              <p v-if="permission.summary" :title="permission.summary" class="truncate text-[11px] leading-4 text-muted">{{ permission.summary }}</p>
                            </div>
                            <UBadge v-if="hasRolePermission(inheritedPermissions, permission)" label="继承" color="info" variant="subtle" class="shrink-0" />
                          </div>
                        </div>
                      </template>
                    </UCollapsible>
                  </div>
                </template>
                <UEmpty v-if="permissionGroups.length === 0" icon="i-lucide-search-x" title="没有匹配的接口" />
              </div>
            </template>
          </div>
        </template>
      </UTabs>
    </template>
    <template #footer="{ close }">
      <UButton label="取消" color="neutral" variant="outline" @click="close" />
      <UButton
        v-if="activeEditorTab === 'basic' && accessStore.hasPermission(editingRole ? 'system:role:update' : 'system:role:create')"
        type="submit"
        form="role-form"
        label="保存基本信息"
        :loading="saving"
      />
      <UButton
        v-if="activeEditorTab === 'menus' && editingRole && !menuAuthorization?.readOnly && accessStore.hasPermission('system:role:authorize')"
        label="保存菜单授权"
        :loading="saving"
        @click="saveMenuAuthorization"
      />
      <UButton v-if="activeEditorTab === 'api' && editingRole && canEditPermissions" label="保存 API 权限" :loading="saving" @click="saveApiPermissions" />
    </template>
  </USlideover>
</template>
