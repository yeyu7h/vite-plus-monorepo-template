<script setup lang="ts">
import type { FormSubmitEvent, TableColumn } from '@nuxt/ui'
import { useToast } from '@nuxt/ui/runtime/composables/useToast.js'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { z } from 'zod'

import type { SystemRoleApi } from '@/api/core/system'
import { systemRoleApi } from '@/api/core/system'
import { ALL_STATUS_VALUE, buildServerListQuery, getApiErrorMessage, getDirectRoleMenuIds, toggleRoleMenuSelection } from '@/features/system-management/helpers'
import { useAdminAccessStore } from '@/stores/access'

definePage({ meta: { title: '角色管理', icon: 'i-lucide-shield-check', order: 10, authority: ['admin'] } })

const accessStore = useAdminAccessStore()
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
const roleForm = reactive({
  id: '',
  name: '',
  description: '',
  status: 'ENABLED' as 'ENABLED' | 'DISABLED',
  parentRoleIds: [] as string[],
})

const deleteOpen = ref(false)
const deletingRole = ref<SystemRoleApi.Item | null>(null)

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

const permissionColumns: TableColumn<NonNullable<SystemRoleApi.PermissionResult>['permissions'][number]>[] = [
  { accessorKey: 'resource', header: 'API 资源' },
  { accessorKey: 'action', header: '方法' },
  { accessorKey: 'sourceRoleId', header: '来源角色' },
  { accessorKey: 'inherited', header: '来源类型' },
]

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
  slideoverOpen.value = true

  if (role) {
    editorLoading.value = true
    try {
      const [menus, apiPermissions] = await Promise.all([systemRoleApi.getMenus(role.id), systemRoleApi.getPermissions(role.id)])
      menuAuthorization.value = menus
      permissions.value = apiPermissions
      selectedMenuIds.value = [...menus.menuIds]
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

function requestDelete(role: SystemRoleApi.Item) {
  deletingRole.value = role
  deleteOpen.value = true
}

async function confirmDelete() {
  if (!deletingRole.value) return
  saving.value = true
  try {
    await systemRoleApi.delete(deletingRole.value.id)
    deleteOpen.value = false
    toast.add({ title: '角色已删除', color: 'success' })
    await Promise.all([loadRoles(), loadAllRoles()])
  } catch (error) {
    toast.add({ title: '删除角色失败', description: getApiErrorMessage(error), color: 'error' })
  } finally {
    saving.value = false
  }
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
        <p class="text-sm text-muted">管理角色继承和菜单授权；Casbin API 权限仅供查看。</p>
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
      <template #status-cell="{ row }"
        ><UBadge :label="row.original.status === 'ENABLED' ? '启用' : '禁用'" :color="row.original.status === 'ENABLED' ? 'success' : 'neutral'" variant="subtle"
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
            <UAlert title="只读权限" description="本页面显示 Casbin 的直接和继承 API 规则，不在此处编辑。" color="info" variant="subtle" class="mb-4" />
            <UTable :data="permissions?.permissions ?? []" :columns="permissionColumns" :loading="editorLoading">
              <template #action-cell="{ row }"><UBadge :label="row.original.action" color="neutral" variant="subtle" /></template>
              <template #inherited-cell="{ row }"><UBadge :label="row.original.inherited ? '继承' : '直接'" :color="row.original.inherited ? 'info' : 'primary'" variant="subtle" /></template>
              <template #empty><UEmpty icon="i-lucide-code-xml" title="暂无 API 权限" /></template>
            </UTable>
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
    </template>
  </USlideover>

  <UModal
    v-model:open="deleteOpen"
    title="删除角色"
    :description="deletingRole ? `将永久删除角色“${deletingRole.name}”。若仍有用户使用它，或其他角色继承它，服务端会拒绝删除。` : ''"
    :ui="{ footer: 'justify-end' }"
  >
    <template #footer="{ close }"
      ><UButton label="取消" color="neutral" variant="outline" @click="close" /><UButton label="确认删除" color="error" :loading="saving" @click="confirmDelete"
    /></template>
  </UModal>
</template>
