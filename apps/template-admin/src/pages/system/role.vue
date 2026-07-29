<script setup lang="ts">
import type { FormSubmitEvent, TableColumn } from '@nuxt/ui'

import Badge from '@nuxt/ui/components/Badge.vue'
import Button from '@nuxt/ui/components/Button.vue'
import Checkbox from '@nuxt/ui/components/Checkbox.vue'
import Form from '@nuxt/ui/components/Form.vue'
import FormField from '@nuxt/ui/components/FormField.vue'
import Input from '@nuxt/ui/components/Input.vue'
import Modal from '@nuxt/ui/components/Modal.vue'
import Pagination from '@nuxt/ui/components/Pagination.vue'
import Select from '@nuxt/ui/components/Select.vue'
import Table from '@nuxt/ui/components/Table.vue'
import Textarea from '@nuxt/ui/components/Textarea.vue'
import Tree from '@nuxt/ui/components/Tree.vue'
import { useToast } from '@nuxt/ui/runtime/composables/useToast.js'
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { z } from 'zod'

import {
  createSystemRoleApi,
  deleteSystemRoleApi,
  getRoleMenuPermissionsApi,
  getSystemRolesApi,
  type RoleMenuPermission,
  type SystemRole,
  type SystemRoleStatus,
  updateSystemRoleApi,
} from '@/api/roles'
import { getMenuTreeApi, type SystemMenuNode } from '@/api/menus'
import { useAdminAccessStore } from '@/stores/access'

definePage({
  meta: {
    title: '角色管理',
    icon: 'i-lucide-shield-check',
    menuGroup: { label: '系统管理', order: 20 },
    order: 20,
    authority: ['admin'],
    contentMode: 'full',
  },
})

type PermissionTreeItem = Omit<RoleMenuPermission, 'children' | 'disabled'> & {
  children: PermissionTreeItem[]
  parentId?: string
  readonly: boolean
}
type RoleFormState = {
  description: string
  id: string
  name: string
  status: SystemRoleStatus
}
type StatusFilter = 'ALL' | SystemRoleStatus

const PAGE_SIZE = 20
const toast = useToast()
const accessStore = useAdminAccessStore()

const roles = ref<SystemRole[]>([])
const total = ref(0)
const page = ref(1)
const searchInput = ref('')
const search = ref('')
const statusFilter = ref<StatusFilter>('ALL')
const loadingRoles = ref(false)
const savingRole = ref(false)
const deletingRole = ref(false)

const roleModalOpen = ref(false)
const deleteModalOpen = ref(false)
const editingRole = ref<SystemRole>()
const pendingDeleteRole = ref<SystemRole>()
const roleState = reactive<RoleFormState>(createEmptyRoleState())

const permissionTree = ref<PermissionTreeItem[]>([])
const expandedPermissionIds = ref<string[]>([])
const loadingPermissions = ref(false)
const permissionsLoaded = ref(false)

const statusOptions = [
  { label: '启用', value: 'ENABLED' },
  { label: '停用', value: 'DISABLED' },
] satisfies Array<{ label: string; value: SystemRoleStatus }>
const statusFilterOptions = [{ label: '全部状态', value: 'ALL' }, ...statusOptions] satisfies Array<{ label: string; value: StatusFilter }>

const roleSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1, '角色标识不能为空')
    .max(64, '角色标识不能超过 64 个字符')
    .regex(/^[a-z0-9_]+$/, '只能使用小写字母、数字和下划线'),
  name: z.string().trim().min(1, '角色名称不能为空').max(64, '角色名称不能超过 64 个字符'),
  description: z.string().max(2000, '角色描述不能超过 2000 个字符'),
  status: z.enum(['ENABLED', 'DISABLED']),
})

const columns: TableColumn<SystemRole>[] = [
  { accessorKey: 'id', header: '角色标识' },
  { accessorKey: 'name', header: '角色名称' },
  { accessorKey: 'description', header: '描述' },
  { accessorKey: 'status', header: '状态' },
  {
    id: 'actions',
    header: '操作',
    meta: { class: { td: 'text-right', th: 'text-right' } },
  },
]

const rangeStart = computed(() => (total.value > 0 ? (page.value - 1) * PAGE_SIZE + 1 : 0))
const rangeEnd = computed(() => Math.min(page.value * PAGE_SIZE, total.value))
const flatPermissions = computed(() => flattenPermissionTree(permissionTree.value))
const selectedPermissionItems = computed(() => flatPermissions.value.filter((permission) => permission.granted))
const isAdminPermissionRole = computed(() => editingRole.value?.id === 'admin')
const canConfigureRolePermissions = computed(() => accessStore.hasPermission('system:role:permission-update'))

let searchTimer: ReturnType<typeof setTimeout> | undefined
let roleListRequestId = 0
let permissionRequestId = 0

function createEmptyRoleState(): RoleFormState {
  return {
    id: '',
    name: '',
    description: '',
    status: 'ENABLED',
  }
}

function flattenPermissionTree(items: PermissionTreeItem[]): PermissionTreeItem[] {
  return items.flatMap((item) => [item, ...flattenPermissionTree(item.children)])
}

function mapRolePermissionTree(items: RoleMenuPermission[], parentId?: string): PermissionTreeItem[] {
  return items.map(({ children, disabled, ...item }) => ({
    ...item,
    parentId,
    readonly: disabled,
    children: mapRolePermissionTree(children, item.id),
  }))
}

function mapMenuTree(items: SystemMenuNode[], parentId?: string): PermissionTreeItem[] {
  return items.map((item) => ({
    action: item.action,
    children: mapMenuTree(item.children, item.id),
    code: item.permissionCode,
    direct: false,
    granted: false,
    id: item.id,
    inherited: false,
    parentId,
    path: item.path,
    readonly: false,
    resource: item.resource,
    title: item.title,
    type: item.type,
  }))
}

function expandAllPermissions() {
  expandedPermissionIds.value = flatPermissions.value.filter((permission) => permission.children.length > 0).map((permission) => permission.id)
}

async function loadRoles() {
  const requestId = ++roleListRequestId
  loadingRoles.value = true
  try {
    const result = await getSystemRolesApi({
      current: page.value,
      pageSize: PAGE_SIZE,
      search: search.value || undefined,
      status: statusFilter.value === 'ALL' ? undefined : statusFilter.value,
    })
    if (requestId !== roleListRequestId) return
    roles.value = result.items
    total.value = result.total
  } catch (error) {
    if (requestId === roleListRequestId) {
      toast.add({ title: '加载角色失败', description: errorMessage(error), color: 'error', icon: 'i-lucide-circle-alert' })
    }
  } finally {
    if (requestId === roleListRequestId) loadingRoles.value = false
  }
}

function setStatusFilter(value: string) {
  statusFilter.value = value as StatusFilter
  page.value = 1
  void loadRoles()
}

function setPage(value: number) {
  if (value === page.value) return
  page.value = value
  void loadRoles()
}

async function openCreateRole() {
  editingRole.value = undefined
  Object.assign(roleState, createEmptyRoleState())
  roleModalOpen.value = true
  permissionTree.value = []
  permissionsLoaded.value = !canConfigureRolePermissions.value
  if (!canConfigureRolePermissions.value) return

  const requestId = ++permissionRequestId
  loadingPermissions.value = true
  try {
    const menus = await getMenuTreeApi()
    if (requestId !== permissionRequestId || editingRole.value) return
    permissionTree.value = mapMenuTree(menus)
    permissionsLoaded.value = true
    expandAllPermissions()
  } catch (error) {
    if (requestId === permissionRequestId) {
      toast.add({ title: '加载菜单权限失败', description: errorMessage(error), color: 'error', icon: 'i-lucide-circle-alert' })
    }
  } finally {
    if (requestId === permissionRequestId) loadingPermissions.value = false
  }
}

async function openEditRole(role: SystemRole) {
  editingRole.value = role
  Object.assign(roleState, {
    id: role.id,
    name: role.name,
    description: role.description ?? '',
    status: role.status,
  })
  roleModalOpen.value = true
  permissionTree.value = []
  permissionsLoaded.value = !canConfigureRolePermissions.value
  if (!canConfigureRolePermissions.value) return

  const requestId = ++permissionRequestId
  loadingPermissions.value = true
  try {
    const result = await getRoleMenuPermissionsApi(role.id)
    if (requestId !== permissionRequestId || editingRole.value?.id !== role.id) return
    permissionTree.value = mapRolePermissionTree(result.menus)
    permissionsLoaded.value = true
    expandAllPermissions()
  } catch (error) {
    if (requestId === permissionRequestId) {
      toast.add({ title: '加载菜单权限失败', description: errorMessage(error), color: 'error', icon: 'i-lucide-circle-alert' })
    }
  } finally {
    if (requestId === permissionRequestId) loadingPermissions.value = false
  }
}

async function submitRole(event: FormSubmitEvent<z.output<typeof roleSchema>>) {
  savingRole.value = true
  try {
    const mutation = {
      name: event.data.name,
      description: event.data.description.trim() || null,
      status: event.data.status,
      ...(canConfigureRolePermissions.value && !isAdminPermissionRole.value
        ? {
            menuIds: flatPermissions.value.filter((permission) => permission.granted && !permission.inherited).map((permission) => permission.id),
          }
        : {}),
    }

    if (editingRole.value) {
      await updateSystemRoleApi(editingRole.value.id, mutation)
    } else {
      await createSystemRoleApi({ id: event.data.id, ...mutation })
      searchInput.value = ''
      search.value = ''
      statusFilter.value = 'ALL'
      page.value = 1
    }

    roleModalOpen.value = false
    toast.add({
      title: editingRole.value ? '角色已更新' : '角色已创建',
      color: 'success',
      icon: 'i-lucide-circle-check',
    })
    await loadRoles()
  } catch (error) {
    toast.add({ title: '保存角色失败', description: errorMessage(error), color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    savingRole.value = false
  }
}

function askDeleteRole(role: SystemRole) {
  if (role.id === 'admin') return
  pendingDeleteRole.value = role
  deleteModalOpen.value = true
}

async function confirmDeleteRole() {
  const role = pendingDeleteRole.value
  if (!role || role.id === 'admin') return

  deletingRole.value = true
  try {
    await deleteSystemRoleApi(role.id)
    deleteModalOpen.value = false

    toast.add({ title: '角色已删除', color: 'success', icon: 'i-lucide-circle-check' })
    if (roles.value.length === 1 && page.value > 1) {
      page.value -= 1
    }
    await loadRoles()
  } catch (error) {
    toast.add({ title: '删除角色失败', description: errorMessage(error), color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    deletingRole.value = false
  }
}

function setGranted(permission: PermissionTreeItem, granted: boolean) {
  if (permission.readonly || isAdminPermissionRole.value || !canConfigureRolePermissions.value) return
  permission.granted = granted
  const byId = new Map(flatPermissions.value.map((item) => [item.id, item]))
  if (granted) {
    let parentId = permission.parentId
    while (parentId) {
      const parent = byId.get(parentId)
      if (!parent) break
      parent.granted = true
      parentId = parent.parentId
    }
    return
  }

  const descendants = new Set<string>([permission.id])
  let changed = true
  while (changed) {
    changed = false
    for (const item of flatPermissions.value) {
      if (item.parentId && descendants.has(item.parentId) && !descendants.has(item.id)) {
        descendants.add(item.id)
        changed = true
      }
    }
  }
  for (const item of flatPermissions.value) {
    if (descendants.has(item.id) && !item.readonly) item.granted = false
  }
}

function onPermissionSelect(event: Event, permission: PermissionTreeItem) {
  event.preventDefault()
  setGranted(permission, !permission.granted)
}

function typeLabel(type: PermissionTreeItem['type']) {
  return { BUTTON: '按钮', DIRECTORY: '目录', EXTERNAL: '外链', IFRAME: 'iframe', PAGE: '页面' }[type]
}

function hasRoleAction(role: SystemRole) {
  return accessStore.hasPermission('system:role:update') || (role.id !== 'admin' && accessStore.hasPermission('system:role:delete'))
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error && 'message' in error && typeof error.message === 'string') return error.message
  return '请求失败'
}

watch(searchInput, (value) => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    const nextSearch = value.trim()
    if (nextSearch === search.value) return
    search.value = nextSearch
    page.value = 1
    void loadRoles()
  }, 300)
})

onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer)
})
onMounted(() => {
  void loadRoles()
})
</script>

<template>
  <div class="flex h-full min-h-0 flex-1 flex-col divide-y divide-default">
    <div class="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
      <div>
        <h1 class="text-lg font-semibold text-highlighted">角色管理</h1>
        <p class="text-sm text-muted">管理系统角色和菜单按钮权限。</p>
      </div>
      <div class="flex items-center gap-2">
        <Button color="neutral" icon="i-lucide-refresh-cw" label="刷新" variant="outline" :loading="loadingRoles" @click="loadRoles" />
        <Button v-if="accessStore.hasPermission('system:role:create')" icon="i-lucide-plus" label="新增角色" @click="openCreateRole" />
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-2 px-4 py-3.5">
      <Input v-model="searchInput" class="w-full sm:max-w-xs" icon="i-lucide-search" placeholder="搜索角色标识或名称" />
      <Select :model-value="statusFilter" :items="statusFilterOptions" class="w-full sm:w-36" label-key="label" value-key="value" @update:model-value="setStatusFilter(String($event))" />
    </div>

    <Table :columns="columns" :data="roles" :loading="loadingRoles" sticky class="min-h-0 flex-1">
      <template #id-cell="{ row }">
        <code class="text-xs text-primary">{{ row.original.id }}</code>
      </template>

      <template #name-cell="{ row }">
        <span class="font-medium text-default">{{ row.original.name }}</span>
      </template>

      <template #description-cell="{ row }">
        <span class="block max-w-80 truncate text-sm text-muted" :title="row.original.description ?? undefined">{{ row.original.description || '—' }}</span>
      </template>

      <template #status-cell="{ row }">
        <Badge :color="row.original.status === 'ENABLED' ? 'success' : 'neutral'" :label="row.original.status === 'ENABLED' ? '启用' : '停用'" variant="subtle" />
      </template>

      <template #actions-cell="{ row }">
        <div v-if="hasRoleAction(row.original)" class="flex justify-end gap-1">
          <Button v-if="accessStore.hasPermission('system:role:update')" aria-label="编辑角色" color="neutral" icon="i-lucide-pencil" size="xs" variant="ghost" @click="openEditRole(row.original)" />
          <Button
            v-if="row.original.id !== 'admin' && accessStore.hasPermission('system:role:delete')"
            aria-label="删除角色"
            color="error"
            icon="i-lucide-trash-2"
            size="xs"
            variant="ghost"
            @click="askDeleteRole(row.original)"
          />
        </div>
        <span v-else class="text-sm text-muted">—</span>
      </template>

      <template #empty>
        <div class="py-12 text-center text-sm text-muted">暂无角色数据</div>
      </template>
    </Table>

    <div class="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
      <span class="text-sm text-muted">第 {{ rangeStart }}–{{ rangeEnd }} 条，共 {{ total }} 条</span>
      <Pagination :page="page" :items-per-page="PAGE_SIZE" :total="total" @update:page="setPage" />
    </div>
  </div>

  <Modal
    v-model:open="roleModalOpen"
    :title="editingRole ? '编辑角色' : '新增角色'"
    :description="editingRole ? '编辑角色资料和菜单按钮权限。' : '填写角色资料并设置菜单按钮权限。'"
    :ui="{ content: 'max-w-4xl', footer: 'justify-end' }"
  >
    <template #body>
      <Form id="role-form" :schema="roleSchema" :state="roleState" class="space-y-4" @submit="submitRole">
        <div class="grid gap-4 sm:grid-cols-2">
          <FormField name="id" label="角色标识" description="创建后不可修改，只能使用小写字母、数字和下划线。" required>
            <Input v-model="roleState.id" class="w-full" :disabled="Boolean(editingRole)" placeholder="例如：content_editor" />
          </FormField>
          <FormField name="name" label="角色名称" required>
            <Input v-model="roleState.name" class="w-full" placeholder="请输入角色名称" />
          </FormField>
          <FormField name="status" label="状态" required>
            <Select v-model="roleState.status" :items="statusOptions" class="w-full" label-key="label" value-key="value" />
          </FormField>
          <FormField name="description" label="角色描述" hint="可选">
            <Textarea v-model="roleState.description" autoresize class="w-full" :maxrows="5" :rows="2" placeholder="说明该角色的用途和职责范围" />
          </FormField>
        </div>

        <div class="space-y-2">
          <div>
            <div class="text-sm font-medium text-default">菜单权限</div>
            <p class="text-xs text-muted">选择角色可见的菜单和可执行的按钮；选择子节点会自动保留上级菜单。</p>
          </div>
          <div class="max-h-96 overflow-auto rounded-lg border border-default p-2">
            <div v-if="loadingPermissions" class="py-12 text-center text-sm text-muted">正在加载菜单权限…</div>
            <div v-else-if="!canConfigureRolePermissions" class="py-12 text-center text-sm text-muted">当前账号没有配置角色权限的权限。</div>
            <div v-else-if="permissionTree.length === 0" class="py-12 text-center text-sm text-muted">暂无菜单节点，请先在菜单管理中创建。</div>
            <template v-else>
              <div v-if="isAdminPermissionRole" class="mb-2 rounded-md bg-elevated/50 px-3 py-2 text-sm text-muted">内置管理员固定拥有全部菜单与按钮权限。</div>
              <Tree
                v-model:expanded="expandedPermissionIds"
                :items="permissionTree"
                :model-value="selectedPermissionItems"
                :get-key="(item) => item.id"
                label-key="title"
                multiple
                bubble-select
                propagate-select
                color="neutral"
                :on-select="onPermissionSelect"
              >
                <template #item-leading="{ item, indeterminate }">
                  <Checkbox
                    :model-value="indeterminate ? 'indeterminate' : item.granted"
                    class="pointer-events-none size-4 shrink-0"
                    :disabled="item.readonly || isAdminPermissionRole"
                    tabindex="-1"
                    :aria-label="`授权 ${item.title}`"
                  />
                </template>
                <template #item-label="{ item }">
                  <span class="inline-flex min-w-0 items-center gap-2 align-middle">
                    <span class="truncate font-medium text-default">{{ item.title }}</span>
                    <Badge color="neutral" :label="typeLabel(item.type)" size="sm" variant="subtle" />
                    <Badge v-if="item.inherited" color="info" label="继承授权" size="sm" variant="subtle" />
                  </span>
                </template>
              </Tree>
            </template>
          </div>
        </div>
      </Form>
    </template>
    <template #footer="{ close }">
      <Button color="neutral" label="取消" variant="outline" @click="close" />
      <Button form="role-form" label="保存" type="submit" :disabled="loadingPermissions || !permissionsLoaded" :loading="savingRole" />
    </template>
  </Modal>

  <Modal
    v-model:open="deleteModalOpen"
    title="确认删除角色"
    :description="`确定删除“${pendingDeleteRole?.name ?? ''}（${pendingDeleteRole?.id ?? ''}）”吗？该角色的用户关联和授权也会被移除。`"
    :ui="{ footer: 'justify-end' }"
  >
    <template #footer="{ close }">
      <Button color="neutral" label="取消" variant="outline" @click="close" />
      <Button color="error" label="删除" :loading="deletingRole" @click="confirmDeleteRole" />
    </template>
  </Modal>
</template>
