<script setup lang="ts">
import type { AdminMenuType } from '@monorepo-admin-core/types'
import type { FormSubmitEvent, TableColumn, TableRow } from '@nuxt/ui'
import type { RouteRecordRaw } from 'vue-router'

import Badge from '@nuxt/ui/components/Badge.vue'
import Button from '@nuxt/ui/components/Button.vue'
import Form from '@nuxt/ui/components/Form.vue'
import FormField from '@nuxt/ui/components/FormField.vue'
import Input from '@nuxt/ui/components/Input.vue'
import InputNumber from '@nuxt/ui/components/InputNumber.vue'
import Modal from '@nuxt/ui/components/Modal.vue'
import Select from '@nuxt/ui/components/Select.vue'
import SelectMenu from '@nuxt/ui/components/SelectMenu.vue'
import Switch from '@nuxt/ui/components/Switch.vue'
import Table from '@nuxt/ui/components/Table.vue'
import { useToast } from '@nuxt/ui/runtime/composables/useToast.js'
import { computed, onMounted, reactive, ref } from 'vue'
import { z } from 'zod'

import {
  createChildMenuApi,
  createMenuApi,
  createMenuGroupApi,
  deleteMenuApi,
  deleteMenuGroupApi,
  getMenuGroupsApi,
  getMenuTreeApi,
  type SystemMenuGroup,
  type SystemMenuMutation,
  type SystemMenuNode,
  updateMenuApi,
  updateMenuGroupApi,
} from '@/api/menus'
import { accessFileRoutes } from '@/router'
import { useAdminAccessStore } from '@/stores/access'

definePage({
  meta: {
    title: '菜单管理',
    icon: 'i-lucide-list-tree',
    menuGroup: { label: '系统管理', order: 30 },
    order: 15,
    authority: ['admin'],
    contentMode: 'full',
  },
})

type ManagementRow =
  | { childrenCount: number; depth: number; group: SystemMenuGroup; id: string; kind: 'group'; title: string }
  | { childrenCount: number; depth: number; id: string; kind: 'menu'; menu: SystemMenuNode; title: string }

type MenuFormState = {
  action: string
  activePath: string
  contentMode: '' | 'default' | 'full'
  description: string
  externalLink: string
  groupId: null | string
  hideInBreadcrumb: boolean
  hideInMenu: boolean
  hideInTab: boolean
  icon: string
  iconDark: string
  iframeSrc: string
  ignoreAccess: boolean
  keepAlive: boolean
  menuVisibleWithForbidden: boolean
  order: number
  parentId: null | string
  path: string
  permissionCode: string
  resource: string
  showActiveTabBorder: boolean
  tabPath: string
  title: string
  type: AdminMenuType
}

const accessStore = useAdminAccessStore()
const toast = useToast()
const loading = ref(false)
const saving = ref(false)
const groups = ref<SystemMenuGroup[]>([])
const menus = ref<SystemMenuNode[]>([])
const expanded = ref(new Set<string>())
const hasLoaded = ref(false)
const menuModalOpen = ref(false)
const groupModalOpen = ref(false)
const deleteModalOpen = ref(false)
const editingMenuId = ref<string>()
const fixedParentId = ref<string>()
const editingGroupId = ref<string>()
const pendingDelete = ref<ManagementRow>()

const groupState = reactive({ name: '', order: 0 })
const menuState = reactive<MenuFormState>(createEmptyMenuState())

const menuTypes = [
  { label: '目录', value: 'DIRECTORY' },
  { label: '本地页面', value: 'PAGE' },
  { label: '外链', value: 'EXTERNAL' },
  { label: 'iframe', value: 'IFRAME' },
  { label: '按钮权限', value: 'BUTTON' },
] satisfies Array<{ label: string; value: AdminMenuType }>

const httpMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
const contentModes = [
  { label: '默认内容区', value: 'default' },
  { label: '全屏内容区', value: 'full' },
]

const groupOptions = computed(() => [{ label: '不选择分组', value: null }, ...groups.value.map((group) => ({ label: group.name, value: group.id }))])
const routeOptions = computed(() => collectFileRoutePaths(accessFileRoutes).map((path) => ({ label: path, value: path })))
const allMenus = computed(() => flattenMenus(menus.value))
const editingMenu = computed(() => (editingMenuId.value ? allMenus.value.find((menu) => menu.id === editingMenuId.value) : undefined))
const parentOptions = computed(() => {
  const excluded = new Set<string>()
  if (editingMenu.value) {
    excluded.add(editingMenu.value.id)
    for (const child of flattenMenus(editingMenu.value.children)) excluded.add(child.id)
  }

  return allMenus.value
    .filter((menu) => !excluded.has(menu.id))
    .filter((menu) => (menuState.type === 'BUTTON' ? menu.type === 'PAGE' : menu.type === 'DIRECTORY' || menu.type === 'PAGE'))
    .map((menu) => ({ label: `${menu.path ?? '按钮'} · ${menu.title}`, value: menu.id }))
})

const rows = computed<ManagementRow[]>(() => {
  const result: ManagementRow[] = []
  const grouped = new Map<string | null, SystemMenuNode[]>()
  for (const menu of menus.value) {
    const bucket = grouped.get(menu.groupId) ?? []
    bucket.push(menu)
    grouped.set(menu.groupId, bucket)
  }

  for (const group of groups.value) {
    const children = grouped.get(group.id) ?? []
    const row: ManagementRow = { kind: 'group', id: `group:${group.id}`, title: group.name, depth: 0, childrenCount: children.length, group }
    result.push(row)
    if (expanded.value.has(row.id)) appendMenuRows(result, children, 1)
  }

  const ungrouped = grouped.get(null) ?? []
  appendMenuRows(result, ungrouped, 0)

  return result
})

const columns: TableColumn<ManagementRow>[] = [
  { accessorKey: 'title', header: '名称' },
  { id: 'type', header: '类型' },
  { id: 'target', header: '路径 / 权限码' },
  { id: 'order', header: '排序' },
  { id: 'actions', header: '' },
]
const tableMeta = {
  class: {
    tr: (row: TableRow<ManagementRow>) => (row.original.kind === 'group' ? 'bg-elevated/50' : ''),
  },
}

const menuSchema = z
  .object({
    type: z.enum(['DIRECTORY', 'PAGE', 'EXTERNAL', 'IFRAME', 'BUTTON']),
    title: z.string().trim().min(1, '名称不能为空').max(128),
    path: z.string(),
    externalLink: z.string(),
    iframeSrc: z.string(),
    permissionCode: z.string(),
    resource: z.string(),
    action: z.string(),
  })
  .passthrough()
  .superRefine((state, context) => {
    if (state.type !== 'BUTTON' && !state.path?.startsWith('/')) {
      context.addIssue({ code: 'custom', path: ['path'], message: '菜单路径必须以 / 开头' })
    }
    if (state.type === 'EXTERNAL' && !isValidUrl(state.externalLink)) {
      context.addIssue({ code: 'custom', path: ['externalLink'], message: '请输入有效的外链地址' })
    }
    if (state.type === 'IFRAME' && !isValidUrl(state.iframeSrc)) {
      context.addIssue({ code: 'custom', path: ['iframeSrc'], message: '请输入有效的 iframe 地址' })
    }
    if (state.type === 'BUTTON') {
      if (!state.permissionCode?.match(/^[a-z][a-z0-9_-]*(?::[a-z0-9_-]+)+$/)) {
        context.addIssue({ code: 'custom', path: ['permissionCode'], message: '示例：system:menu:create' })
      }
      if (!state.resource?.startsWith('/')) context.addIssue({ code: 'custom', path: ['resource'], message: 'API 资源必须以 / 开头' })
      if (!state.action) context.addIssue({ code: 'custom', path: ['action'], message: '请选择 HTTP 方法' })
    }
  })

const groupSchema = z.object({
  name: z.string().trim().min(1, '分组名称不能为空').max(128),
  order: z.number().int().min(0),
})

function createEmptyMenuState(): MenuFormState {
  return {
    type: 'PAGE',
    title: '',
    path: '',
    parentId: null,
    groupId: null,
    icon: '',
    iconDark: '',
    order: 0,
    activePath: '',
    contentMode: '',
    description: '',
    externalLink: '',
    hideInBreadcrumb: false,
    hideInMenu: false,
    hideInTab: false,
    iframeSrc: '',
    ignoreAccess: false,
    keepAlive: false,
    menuVisibleWithForbidden: false,
    showActiveTabBorder: false,
    tabPath: '',
    permissionCode: '',
    resource: '',
    action: '',
  }
}

function flattenMenus(items: readonly SystemMenuNode[]): SystemMenuNode[] {
  return items.flatMap((menu) => [menu, ...flattenMenus(menu.children)])
}

function appendMenuRows(result: ManagementRow[], items: readonly SystemMenuNode[], depth: number) {
  for (const menu of items) {
    result.push({ kind: 'menu', id: menu.id, title: menu.title, depth, childrenCount: menu.children.length, menu })
    if (menu.children.length > 0 && expanded.value.has(menu.id)) appendMenuRows(result, menu.children, depth + 1)
  }
}

function collectFileRoutePaths(routes: readonly RouteRecordRaw[], parentPath = ''): string[] {
  return routes.flatMap((route) => {
    const path = route.path.startsWith('/') ? route.path : `${parentPath.replace(/\/$/, '')}/${route.path}`.replace(/\/+/g, '/')
    return [path, ...(route.children ? collectFileRoutePaths(route.children, path) : [])]
  })
}

function isValidUrl(value: string) {
  if (!value) return false
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol)
  } catch {
    return false
  }
}

function typeLabel(type: AdminMenuType) {
  return menuTypes.find((item) => item.value === type)?.label ?? type
}

function typeColor(type: AdminMenuType) {
  if (type === 'BUTTON') return 'warning' as const
  if (type === 'PAGE') return 'primary' as const
  if (type === 'DIRECTORY') return 'neutral' as const
  return 'info' as const
}

function toggleExpanded(row: ManagementRow) {
  const next = new Set(expanded.value)
  if (next.has(row.id)) next.delete(row.id)
  else next.add(row.id)
  expanded.value = next
}

async function loadData() {
  loading.value = true
  try {
    const [nextGroups, nextMenus] = await Promise.all([getMenuGroupsApi(), getMenuTreeApi()])
    const previousGroupRowIds = new Set(groups.value.map((group) => `group:${group.id}`))
    const nextGroupRowIds = nextGroups.map((group) => `group:${group.id}`)
    groups.value = nextGroups
    menus.value = nextMenus
    const validExpandableIds = new Set([
      ...nextGroupRowIds,
      ...flattenMenus(nextMenus)
        .filter((menu) => menu.children.length > 0)
        .map((menu) => menu.id),
    ])
    const nextExpanded = new Set([...expanded.value].filter((id) => validExpandableIds.has(id)))
    for (const groupRowId of nextGroupRowIds) {
      if (!hasLoaded.value || !previousGroupRowIds.has(groupRowId)) nextExpanded.add(groupRowId)
    }
    expanded.value = nextExpanded
    hasLoaded.value = true
  } catch (error) {
    toast.add({ title: '加载菜单失败', description: errorMessage(error), color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    loading.value = false
  }
}

function openCreateMenu(groupId: null | string = null) {
  editingMenuId.value = undefined
  fixedParentId.value = undefined
  Object.assign(menuState, createEmptyMenuState(), { groupId })
  menuModalOpen.value = true
}

function openCreateChild(menu: SystemMenuNode) {
  editingMenuId.value = undefined
  fixedParentId.value = menu.id
  Object.assign(menuState, createEmptyMenuState(), { parentId: menu.id, groupId: null, type: menu.type === 'PAGE' ? 'BUTTON' : 'PAGE' })
  menuModalOpen.value = true
}

function openEditMenu(menu: SystemMenuNode) {
  editingMenuId.value = menu.id
  fixedParentId.value = undefined
  const icon = typeof menu.icon === 'string' ? menu.icon : (menu.icon?.light ?? '')
  const iconDark = typeof menu.icon === 'object' && menu.icon ? (menu.icon.dark ?? '') : ''
  Object.assign(menuState, {
    ...createEmptyMenuState(),
    ...menu,
    children: undefined,
    path: menu.path ?? '',
    activePath: menu.activePath ?? '',
    contentMode: menu.contentMode ?? '',
    description: menu.description ?? '',
    externalLink: menu.externalLink ?? '',
    iframeSrc: menu.iframeSrc ?? '',
    permissionCode: menu.permissionCode ?? '',
    resource: menu.resource ?? '',
    action: menu.action ?? '',
    tabPath: menu.tabPath ?? '',
    icon,
    iconDark,
  })
  menuModalOpen.value = true
}

function openCreateGroup() {
  editingGroupId.value = undefined
  Object.assign(groupState, { name: '', order: 0 })
  groupModalOpen.value = true
}

function openEditGroup(group: SystemMenuGroup) {
  editingGroupId.value = group.id
  Object.assign(groupState, { name: group.name, order: group.order })
  groupModalOpen.value = true
}

async function submitMenu() {
  saving.value = true
  try {
    const state = menuState
    const payload: SystemMenuMutation = {
      ...state,
      parentId: fixedParentId.value ?? state.parentId,
      groupId: state.parentId || fixedParentId.value ? null : state.groupId,
      icon: state.icon ? (state.iconDark ? { light: state.icon, dark: state.iconDark } : state.icon) : null,
      path: state.path || null,
      activePath: state.activePath || null,
      contentMode: state.contentMode || null,
      description: state.description || null,
      externalLink: state.externalLink || null,
      iframeSrc: state.iframeSrc || null,
      permissionCode: state.permissionCode || null,
      resource: state.resource || null,
      action: state.action.toUpperCase() || null,
      tabPath: state.tabPath || null,
    }

    if (editingMenuId.value) await updateMenuApi(editingMenuId.value, payload)
    else if (fixedParentId.value) await createChildMenuApi(fixedParentId.value, payload)
    else await createMenuApi(payload)

    menuModalOpen.value = false
    toast.add({ title: editingMenuId.value ? '菜单已更新' : '菜单已创建', color: 'success', icon: 'i-lucide-circle-check' })
    await loadData()
  } catch (error) {
    toast.add({ title: '保存菜单失败', description: errorMessage(error), color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    saving.value = false
  }
}

async function submitGroup(event: FormSubmitEvent<{ name: string; order: number }>) {
  saving.value = true
  try {
    if (editingGroupId.value) await updateMenuGroupApi(editingGroupId.value, event.data)
    else await createMenuGroupApi(event.data)
    groupModalOpen.value = false
    toast.add({ title: editingGroupId.value ? '分组已更新' : '分组已创建', color: 'success', icon: 'i-lucide-circle-check' })
    await loadData()
  } catch (error) {
    toast.add({ title: '保存分组失败', description: errorMessage(error), color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    saving.value = false
  }
}

function askDelete(row: ManagementRow) {
  pendingDelete.value = row
  deleteModalOpen.value = true
}

async function confirmDelete() {
  if (!pendingDelete.value) return
  saving.value = true
  try {
    if (pendingDelete.value.kind === 'group') await deleteMenuGroupApi(pendingDelete.value.group.id)
    else await deleteMenuApi(pendingDelete.value.menu.id)
    deleteModalOpen.value = false
    toast.add({ title: '删除成功', color: 'success', icon: 'i-lucide-circle-check' })
    await loadData()
  } catch (error) {
    toast.add({ title: '删除失败', description: errorMessage(error), color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    saving.value = false
  }
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error && 'message' in error && typeof error.message === 'string') return error.message
  return '请求失败'
}

onMounted(loadData)
</script>

<template>
  <div class="flex h-full min-h-0 flex-1 flex-col divide-y divide-default">
    <div class="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
      <div>
        <h1 class="text-lg font-semibold text-highlighted">菜单管理</h1>
        <p class="text-sm text-muted">管理导航层级、菜单分组与页面按钮权限；导航变化将在下次登录生效。</p>
      </div>
      <div class="flex items-center gap-2">
        <Button color="neutral" icon="i-lucide-refresh-cw" label="刷新" variant="outline" :loading="loading" @click="loadData" />
        <Button v-if="accessStore.hasPermission('system:menu-group:create')" color="neutral" icon="i-lucide-folder-plus" label="新增菜单分组" variant="outline" @click="openCreateGroup" />
        <Button v-if="accessStore.hasPermission('system:menu:create')" icon="i-lucide-plus" label="新增菜单" @click="openCreateMenu()" />
      </div>
    </div>

    <Table :columns="columns" :data="rows" :loading="loading" :meta="tableMeta" sticky class="min-h-0 flex-1">
      <template #title-cell="{ row }">
        <div class="flex min-w-64 items-center gap-2" :style="{ paddingLeft: `${row.original.depth * 18}px` }">
          <Button
            v-if="row.original.childrenCount > 0"
            :icon="expanded.has(row.original.id) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
            aria-label="展开或收起"
            color="neutral"
            size="xs"
            variant="ghost"
            @click="toggleExpanded(row.original)"
          />
          <span v-else class="inline-block size-7" />
          <span :class="row.original.kind === 'group' ? 'font-semibold text-highlighted' : 'font-medium text-default'">{{ row.original.title }}</span>
        </div>
      </template>

      <template #type-cell="{ row }">
        <Badge v-if="row.original.kind === 'group'" color="neutral" label="分组" variant="subtle" />
        <Badge v-else :color="typeColor(row.original.menu.type)" :label="typeLabel(row.original.menu.type)" variant="subtle" />
      </template>

      <template #target-cell="{ row }">
        <span v-if="row.original.kind === 'group'" class="text-sm text-muted">—</span>
        <code v-else class="text-xs text-muted">{{ row.original.menu.permissionCode ?? row.original.menu.path ?? '—' }}</code>
      </template>

      <template #order-cell="{ row }">
        <span class="text-sm text-muted">{{ row.original.kind === 'group' ? row.original.group.order : row.original.menu.order }}</span>
      </template>

      <template #actions-cell="{ row }">
        <div class="flex justify-end gap-1">
          <template v-if="row.original.kind === 'group'">
            <Button
              v-if="row.original.group.id !== 'default' && accessStore.hasPermission('system:menu:create')"
              aria-label="在分组中新建菜单"
              color="neutral"
              icon="i-lucide-plus"
              size="xs"
              variant="ghost"
              @click="openCreateMenu(row.original.group.id)"
            />
            <Button
              v-if="row.original.group.id !== 'default' && accessStore.hasPermission('system:menu-group:update')"
              aria-label="编辑分组"
              color="neutral"
              icon="i-lucide-pencil"
              size="xs"
              variant="ghost"
              @click="openEditGroup(row.original.group)"
            />
            <Button
              v-if="row.original.group.id !== 'default' && accessStore.hasPermission('system:menu-group:delete')"
              aria-label="删除分组"
              color="error"
              icon="i-lucide-trash-2"
              size="xs"
              variant="ghost"
              @click="askDelete(row.original)"
            />
          </template>
          <template v-else>
            <Button
              v-if="['DIRECTORY', 'PAGE'].includes(row.original.menu.type) && accessStore.hasPermission('system:menu:create-child')"
              aria-label="新增下级"
              color="neutral"
              icon="i-lucide-list-plus"
              size="xs"
              variant="ghost"
              @click="openCreateChild(row.original.menu)"
            />
            <Button
              v-if="accessStore.hasPermission('system:menu:update')"
              aria-label="编辑菜单"
              color="neutral"
              icon="i-lucide-pencil"
              size="xs"
              variant="ghost"
              @click="openEditMenu(row.original.menu)"
            />
            <Button v-if="accessStore.hasPermission('system:menu:delete')" aria-label="删除菜单" color="error" icon="i-lucide-trash-2" size="xs" variant="ghost" @click="askDelete(row.original)" />
          </template>
        </div>
      </template>

      <template #empty>
        <div class="py-12 text-center text-sm text-muted">暂无菜单数据</div>
      </template>
    </Table>
  </div>

  <Modal v-model:open="menuModalOpen" :title="editingMenuId ? '编辑菜单' : fixedParentId ? '新增下级' : '新增菜单'" :ui="{ content: 'max-w-3xl', footer: 'justify-end' }">
    <template #body>
      <Form id="menu-form" :schema="menuSchema" :state="menuState" class="grid grid-cols-1 gap-4 md:grid-cols-2" @submit="submitMenu">
        <FormField name="type" label="类型" required>
          <Select v-model="menuState.type" :items="menuTypes" label-key="label" value-key="value" class="w-full" />
        </FormField>
        <FormField name="title" label="名称" required>
          <Input v-model="menuState.title" class="w-full" />
        </FormField>

        <FormField v-if="!fixedParentId" name="parentId" label="父菜单" hint="不选为顶级">
          <SelectMenu v-model="menuState.parentId" :items="parentOptions" label-key="label" value-key="value" class="w-full" clear />
        </FormField>
        <FormField v-if="!fixedParentId && !menuState.parentId && menuState.type !== 'BUTTON'" name="groupId" label="菜单分组">
          <Select v-model="menuState.groupId" :items="groupOptions" label-key="label" value-key="value" class="w-full" />
        </FormField>

        <FormField v-if="menuState.type === 'PAGE'" name="path" label="本地页面" required>
          <SelectMenu v-model="menuState.path" :items="routeOptions" label-key="label" value-key="value" class="w-full" searchable />
        </FormField>
        <FormField v-if="menuState.type === 'PAGE'" name="permissionCode" label="权限码" hint="可选">
          <Input v-model="menuState.permissionCode" class="w-full" placeholder="system:menu:view" />
        </FormField>
        <FormField v-else-if="menuState.type !== 'BUTTON'" name="path" label="菜单路径" required>
          <Input v-model="menuState.path" class="w-full" placeholder="/system/example" />
        </FormField>
        <FormField v-if="menuState.type === 'EXTERNAL'" name="externalLink" label="外链地址" required>
          <Input v-model="menuState.externalLink" class="w-full" placeholder="https://example.com" />
        </FormField>
        <FormField v-if="menuState.type === 'IFRAME'" name="iframeSrc" label="iframe 地址" required>
          <Input v-model="menuState.iframeSrc" class="w-full" placeholder="https://example.com" />
        </FormField>

        <template v-if="menuState.type === 'BUTTON'">
          <FormField name="permissionCode" label="权限码" required>
            <Input v-model="menuState.permissionCode" class="w-full" placeholder="system:menu:create" />
          </FormField>
          <FormField name="resource" label="API 资源" required>
            <Input v-model="menuState.resource" class="w-full" placeholder="/system/menus" />
          </FormField>
          <FormField name="action" label="HTTP 方法" required>
            <Select v-model="menuState.action" :items="httpMethods" class="w-full" />
          </FormField>
        </template>

        <FormField name="order" label="排序">
          <InputNumber v-model="menuState.order" :min="0" class="w-full" />
        </FormField>

        <template v-if="menuState.type !== 'BUTTON'">
          <FormField name="icon" label="亮色图标" description="Iconify 名称或图片 URL">
            <Input v-model="menuState.icon" class="w-full" placeholder="i-lucide-menu" />
          </FormField>
          <FormField name="iconDark" label="暗色图片图标" hint="可选">
            <Input v-model="menuState.iconDark" class="w-full" placeholder="https://..." />
          </FormField>
          <FormField name="contentMode" label="内容布局">
            <Select v-model="menuState.contentMode" :items="contentModes" label-key="label" value-key="value" class="w-full" />
          </FormField>
          <FormField name="description" label="描述">
            <Input v-model="menuState.description" class="w-full" />
          </FormField>
          <FormField name="activePath" label="激活路径" hint="可选">
            <Input v-model="menuState.activePath" class="w-full" placeholder="/system/settings" />
          </FormField>
          <FormField name="tabPath" label="标签页复用路径" hint="可选">
            <Input v-model="menuState.tabPath" class="w-full" placeholder="/system/settings" />
          </FormField>
          <div class="md:col-span-2 grid grid-cols-2 gap-3 rounded-md border border-default bg-elevated/40 p-3 sm:grid-cols-4">
            <Switch v-model="menuState.hideInMenu" label="菜单隐藏" />
            <Switch v-model="menuState.hideInBreadcrumb" label="面包屑隐藏" />
            <Switch v-model="menuState.hideInTab" label="标签页隐藏" />
            <Switch v-model="menuState.keepAlive" label="页面保活" />
            <Switch v-model="menuState.ignoreAccess" label="忽略访问控制" />
            <Switch v-model="menuState.menuVisibleWithForbidden" label="无权仍可见" />
            <Switch v-model="menuState.showActiveTabBorder" label="激活边框" />
          </div>
        </template>
      </Form>
    </template>
    <template #footer="{ close }">
      <Button color="neutral" label="取消" variant="outline" @click="close" />
      <Button form="menu-form" label="保存" type="submit" :loading="saving" />
    </template>
  </Modal>

  <Modal v-model:open="groupModalOpen" :title="editingGroupId ? '编辑菜单分组' : '新增菜单分组'" :ui="{ footer: 'justify-end' }">
    <template #body>
      <Form id="group-form" :schema="groupSchema" :state="groupState" class="space-y-4" @submit="submitGroup">
        <FormField name="name" label="分组名称" required>
          <Input v-model="groupState.name" class="w-full" />
        </FormField>
        <FormField name="order" label="排序">
          <InputNumber v-model="groupState.order" :min="0" class="w-full" />
        </FormField>
      </Form>
    </template>
    <template #footer="{ close }">
      <Button color="neutral" label="取消" variant="outline" @click="close" />
      <Button form="group-form" label="保存" type="submit" :loading="saving" />
    </template>
  </Modal>

  <Modal v-model:open="deleteModalOpen" title="确认删除" :description="`确定删除“${pendingDelete?.title ?? ''}”吗？有下级的菜单或仍有菜单的分组将被拒绝。`" :ui="{ footer: 'justify-end' }">
    <template #footer="{ close }">
      <Button color="neutral" label="取消" variant="outline" @click="close" />
      <Button color="error" label="删除" :loading="saving" @click="confirmDelete" />
    </template>
  </Modal>
</template>
