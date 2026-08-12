<script setup lang="ts">
import type { FormSubmitEvent, TableColumn, TableRow } from '@nuxt/ui'
import { resolveAdminRoutePath } from '@monorepo-admin-core/access-effect'
import { useToast } from '@nuxt/ui/runtime/composables/useToast.js'
import { computed, onMounted, reactive, ref } from 'vue'
import { z } from 'zod'

import type { SystemMenuApi } from '@/api/core/system'
import { systemMenuApi } from '@/api/core/system'
import { countMenuSubtree, flattenMenuTree, getApiErrorMessage } from '@/features/system-management/helpers'
import { useAdminAccessStore } from '@/stores/access'

definePage({
  meta: { title: '菜单管理', icon: 'i-lucide-list-tree', order: 20, authority: ['admin'], contentMode: 'full' },
})

type MenuNodeType = 'group' | 'directory' | 'menu' | 'button'

const accessStore = useAdminAccessStore()
const toast = useToast()
const loading = ref(false)
const saving = ref(false)
const tree = ref<SystemMenuApi.Node[]>([])
const expandedIds = ref(new Set<string>())
const columnPinning = ref({ right: ['actions'] })

const menuSlideoverOpen = ref(false)
const editingMenu = ref<SystemMenuApi.Node | null>(null)
const menuForm = reactive({
  id: '',
  title: '',
  type: 'menu' as MenuNodeType,
  parentId: null as string | null,
  path: '',
  accessScope: 'restricted' as 'public' | 'restricted',
  status: 'ENABLED' as 'ENABLED' | 'DISABLED',
  order: 0,
  permissionCode: '',
  description: '',
  iconKind: 'iconify' as 'iconify' | 'image',
  icon: '',
  iconLight: '',
  iconDark: '',
  activePath: '',
  externalLink: '',
  iframeSrc: '',
  hideInBreadcrumb: false,
  hideInMenu: false,
  hideInTab: false,
  keepAlive: false,
  menuVisibleWithForbidden: false,
  tabPath: '',
})

const deleteMenuOpen = ref(false)
const deletingMenu = ref<SystemMenuApi.Node | null>(null)

const flatRows = computed(() => flattenMenuTree(tree.value, expandedIds.value))
const allMenuNodes = computed(() => {
  const ids = new Set<string>()
  const collect = (nodes: readonly SystemMenuApi.Node[]) => {
    for (const node of nodes) {
      ids.add(node.id)
      collect(node.children ?? [])
    }
  }
  collect(tree.value)
  return flattenMenuTree(tree.value, ids)
})

function findMenuNode(nodes: readonly SystemMenuApi.Node[], id: string): SystemMenuApi.Node | undefined {
  for (const node of nodes) {
    if (node.id === id) return node
    const child = findMenuNode(node.children ?? [], id)
    if (child) return child
  }
}

function findRouteDepth(nodes: readonly SystemMenuApi.Node[], id: string, depth = 0): number | undefined {
  for (const node of nodes) {
    const nodeDepth = node.type === 'group' ? depth : depth + 1
    if (node.id === id) return nodeDepth
    const childDepth = findRouteDepth(node.children ?? [], id, nodeDepth)
    if (childDepth !== undefined) return childDepth
  }
}

function findMenuRoutePath(nodes: readonly SystemMenuApi.Node[], id: string, parentPath = ''): string | undefined {
  for (const node of nodes) {
    const nodePath = node.type === 'group' || !node.path ? parentPath : resolveAdminRoutePath(parentPath, node.path)
    if (node.id === id) return nodePath
    const childPath = findMenuRoutePath(node.children ?? [], id, nodePath)
    if (childPath !== undefined) return childPath
  }
}

const menuFormDepth = computed(() => {
  if (menuForm.type === 'group') return 0
  if (!menuForm.parentId) return 1
  return (findRouteDepth(tree.value, menuForm.parentId) ?? 0) + 1
})
const menuHasRoute = computed(() => menuForm.type === 'directory' || menuForm.type === 'menu')
const menuSupportsIcon = computed(() => menuHasRoute.value && menuFormDepth.value < 3)
const parentIsGroup = computed(() => (menuForm.parentId ? findMenuNode(tree.value, menuForm.parentId)?.type === 'group' : false))
const parentRoutePath = computed(() => {
  if (!menuForm.parentId || parentIsGroup.value) return ''
  return findMenuRoutePath(tree.value, menuForm.parentId) ?? ''
})
const parentRoutePrefix = computed(() => (parentRoutePath.value === '/' ? '/' : `${parentRoutePath.value}/`))

const parentOptions = computed(() => {
  const rootOption = { label: '无（根节点）', value: null }
  if (menuForm.type === 'group') return [rootOption]

  return [
    rootOption,
    ...allMenuNodes.value
      .filter((node) => node.type !== 'button' && node.id !== editingMenu.value?.id && !(menuForm.type === 'button' && node.type === 'group'))
      .map((node) => ({ label: `${'　'.repeat(node.depth)}${node.title}`, value: node.id })),
  ]
})

const menuSchema = z
  .object({
    id: z
      .string()
      .min(1, '请输入节点 ID')
      .regex(/^[a-z0-9_-]+$/, '只能包含小写字母、数字、下划线和连字符'),
    title: z.string().min(1, '请输入标题'),
    type: z.enum(['group', 'directory', 'menu', 'button']),
    path: z.string(),
    permissionCode: z.string(),
    iconKind: z.enum(['iconify', 'image']),
    icon: z.string(),
    iconLight: z.string(),
    iconDark: z.string(),
    activePath: z.string().max(255, '高亮路径最多 255 个字符'),
    externalLink: z.string().max(2000, '外部链接最多 2000 个字符'),
    iframeSrc: z.string().max(2000, 'iframe 地址最多 2000 个字符'),
    hideInBreadcrumb: z.boolean(),
    hideInMenu: z.boolean(),
    hideInTab: z.boolean(),
    keepAlive: z.boolean(),
    menuVisibleWithForbidden: z.boolean(),
    tabPath: z.string().max(255, 'Tab 路径最多 255 个字符'),
  })
  .superRefine((value, ctx) => {
    const path = value.path.trim()
    if (value.type !== 'group' && !path) ctx.addIssue({ code: 'custom', path: ['path'], message: '请输入路径' })
    if (value.type === 'button' && !value.permissionCode.trim()) ctx.addIssue({ code: 'custom', path: ['permissionCode'], message: '按钮必须填写权限码' })
    if (menuSupportsIcon.value && value.iconKind === 'image' && !value.iconLight.trim()) ctx.addIssue({ code: 'custom', path: ['iconLight'], message: '图片图标必须填写亮色图片地址' })
    if (menuHasRoute.value && value.externalLink.trim() && value.iframeSrc.trim()) {
      ctx.addIssue({ code: 'custom', path: ['externalLink'], message: '外部链接和 iframe 地址不能同时设置' })
      ctx.addIssue({ code: 'custom', path: ['iframeSrc'], message: 'iframe 地址和外部链接不能同时设置' })
    }
    if (menuHasRoute.value && value.activePath.trim() && !value.activePath.trim().startsWith('/')) ctx.addIssue({ code: 'custom', path: ['activePath'], message: '高亮路径必须以 / 开头' })
    if (menuHasRoute.value && !value.hideInTab && value.tabPath.trim() && !value.tabPath.trim().startsWith('/')) ctx.addIssue({ code: 'custom', path: ['tabPath'], message: 'Tab 路径必须以 / 开头' })
    if (value.type !== 'group' && path) {
      const requiresAbsolutePath = !menuForm.parentId || parentIsGroup.value
      if (requiresAbsolutePath && !path.startsWith('/')) ctx.addIssue({ code: 'custom', path: ['path'], message: '根菜单路径必须以 / 开头' })
      if (!requiresAbsolutePath && path.startsWith('/')) ctx.addIssue({ code: 'custom', path: ['path'], message: '子节点路径必须使用相对路径' })
    }
  })

const menuColumns: TableColumn<SystemMenuApi.Node & { depth: number; descendantCount: number }>[] = [
  { accessorKey: 'title', header: '节点' },
  { accessorKey: 'type', header: '类型' },
  { accessorKey: 'path', header: '路径 / 权限码' },
  { accessorKey: 'accessScope', header: '访问范围' },
  { accessorKey: 'order', header: '排序' },
  { accessorKey: 'status', header: '状态' },
  {
    id: 'actions',
    header: '操作',
    meta: {
      class: {
        th: 'w-32 min-w-32 max-w-32',
        td: (cell) => `w-32 min-w-32 max-w-32${cell.row.original.type === 'group' ? ' bg-muted' : ''}`,
      },
    },
  },
]

const menuTableMeta = {
  class: {
    tr: (row: TableRow<SystemMenuApi.Node & { depth: number; descendantCount: number }>) => (row.original.type === 'group' ? 'bg-muted' : ''),
  },
}

function menuTypeLabel(type: string) {
  if (type === 'group') return '分组'
  if (type === 'directory') return '目录'
  if (type === 'button') return '按钮'
  return '菜单'
}

function menuTypeColor(type: string): 'neutral' | 'info' | 'primary' | 'warning' {
  if (type === 'group') return 'warning'
  if (type === 'directory') return 'info'
  if (type === 'button') return 'neutral'
  return 'primary'
}

function menuTypeIcon(type: string) {
  if (type === 'group') return 'i-lucide-panels-top-left'
  if (type === 'directory') return 'i-lucide-folder'
  if (type === 'button') return 'i-lucide-mouse-pointer-click'
  return 'i-lucide-file'
}

function menuTreeShowsIcon(menu: SystemMenuApi.Node): boolean {
  if (menu.type !== 'directory' && menu.type !== 'menu') return true
  return (findRouteDepth(tree.value, menu.id) ?? 1) < 3
}

function menuTablePath(menu: SystemMenuApi.Node): string {
  if (menu.type === 'button') return menu.permissionCode ?? ''
  if (menu.type === 'group') return ''
  return findMenuRoutePath(tree.value, menu.id) ?? menu.path ?? ''
}

function isMenuImageIcon(icon: unknown): icon is { dark?: string; light: string } {
  return typeof icon === 'object' && icon !== null && !Array.isArray(icon) && 'light' in icon && typeof icon.light === 'string'
}

function getMenuImageIcon(icon: { dark?: string; light: string }, theme: 'light' | 'dark' = 'light'): string {
  return theme === 'dark' ? (icon.dark ?? icon.light) : icon.light
}

async function loadData() {
  const requestSessionVersion = accessStore.sessionVersion
  loading.value = true
  try {
    const nextTree = await systemMenuApi.getTree()
    tree.value = nextTree
    if (expandedIds.value.size === 0) expandedIds.value = new Set(nextTree.map(({ id }) => id))
  } catch (error) {
    if (accessStore.isLoggedIn && accessStore.sessionVersion === requestSessionVersion) {
      toast.add({ title: '加载菜单失败', description: getApiErrorMessage(error), color: 'error' })
    }
  } finally {
    loading.value = false
  }
}

function toggleExpanded(id: string) {
  const next = new Set(expandedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expandedIds.value = next
}

function openMenuForm(menu?: SystemMenuApi.Node, parentId?: string, initialType: MenuNodeType = 'menu') {
  editingMenu.value = menu ?? null
  const icon = menu?.icon
  const imageIcon = isMenuImageIcon(icon) ? icon : null
  const type = (menu?.type ?? initialType) as MenuNodeType
  Object.assign(menuForm, {
    id: menu?.id ?? '',
    title: menu?.title ?? '',
    type,
    parentId: type === 'group' ? null : (menu?.parentId ?? parentId ?? null),
    path: menu?.path ?? '',
    accessScope: type === 'group' ? 'public' : (menu?.accessScope ?? 'restricted'),
    status: menu?.status ?? 'ENABLED',
    order: menu?.order ?? 0,
    permissionCode: menu?.permissionCode ?? '',
    description: menu?.description ?? '',
    iconKind: imageIcon ? 'image' : 'iconify',
    icon: typeof icon === 'string' ? icon : '',
    iconLight: imageIcon?.light ?? '',
    iconDark: imageIcon?.dark ?? '',
    activePath: menu?.activePath ?? '',
    externalLink: menu?.externalLink ?? '',
    iframeSrc: menu?.iframeSrc ?? '',
    hideInBreadcrumb: menu?.hideInBreadcrumb ?? false,
    hideInMenu: menu?.hideInMenu ?? false,
    hideInTab: menu?.hideInTab ?? false,
    keepAlive: menu?.keepAlive ?? false,
    menuVisibleWithForbidden: menu?.menuVisibleWithForbidden ?? false,
    tabPath: menu?.tabPath ?? '',
  })
  menuSlideoverOpen.value = true
}

async function saveMenu(event: FormSubmitEvent<z.output<typeof menuSchema>>) {
  saving.value = true
  const isGroup = menuForm.type === 'group'
  const hasRoute = menuHasRoute.value
  const icon = menuSupportsIcon.value
    ? menuForm.iconKind === 'image'
      ? { light: menuForm.iconLight.trim(), ...(menuForm.iconDark.trim() ? { dark: menuForm.iconDark.trim() } : {}) }
      : menuForm.icon.trim() || null
    : null
  const body = {
    title: event.data.title,
    type: event.data.type,
    path: isGroup ? null : event.data.path.trim(),
    parentId: isGroup ? null : menuForm.parentId,
    accessScope: isGroup ? ('public' as const) : menuForm.accessScope,
    status: menuForm.status,
    order: menuForm.order,
    permissionCode: menuForm.type === 'button' ? menuForm.permissionCode.trim() : null,
    description: menuForm.description || null,
    icon,
    activePath: hasRoute ? menuForm.activePath.trim() || null : null,
    externalLink: hasRoute ? menuForm.externalLink.trim() || null : null,
    iframeSrc: hasRoute ? menuForm.iframeSrc.trim() || null : null,
    contentMode: hasRoute ? (editingMenu.value?.contentMode ?? null) : null,
    hideInBreadcrumb: hasRoute && menuForm.hideInBreadcrumb,
    hideInMenu: hasRoute && menuForm.hideInMenu,
    hideInTab: hasRoute && menuForm.hideInTab,
    ignoreAccess: hasRoute && (editingMenu.value?.ignoreAccess ?? false),
    keepAlive: hasRoute && !menuForm.hideInTab && menuForm.keepAlive,
    menuVisibleWithForbidden: hasRoute && menuForm.accessScope === 'restricted' && menuForm.menuVisibleWithForbidden,
    showActiveTabBorder: hasRoute && (editingMenu.value?.showActiveTabBorder ?? false),
    tabPath: hasRoute && !menuForm.hideInTab ? menuForm.tabPath.trim() || null : null,
  }
  try {
    if (editingMenu.value) await systemMenuApi.update(editingMenu.value.id, body)
    else await systemMenuApi.create({ id: event.data.id, ...body })
    menuSlideoverOpen.value = false
    toast.add({ title: editingMenu.value ? '菜单节点已更新' : '菜单节点已创建', color: 'success', icon: 'i-lucide-circle-check' })
    await loadData()
  } catch (error) {
    toast.add({ title: '保存菜单节点失败', description: getApiErrorMessage(error), color: 'error' })
  } finally {
    saving.value = false
  }
}

function requestDeleteMenu(menu: SystemMenuApi.Node) {
  deletingMenu.value = menu
  deleteMenuOpen.value = true
}

async function confirmDeleteMenu() {
  if (!deletingMenu.value) return
  saving.value = true
  try {
    const result = await systemMenuApi.delete(deletingMenu.value.id)
    deleteMenuOpen.value = false
    toast.add({ title: deletingMenu.value.type === 'group' ? '菜单分组已删除' : '菜单已删除', description: `共删除 ${result.deletedCount} 个节点。`, color: 'success' })
    await loadData()
  } catch (error) {
    toast.add({ title: '删除菜单节点失败', description: getApiErrorMessage(error), color: 'error' })
  } finally {
    saving.value = false
  }
}

onMounted(loadData)
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <div v-if="accessStore.hasPermission('system:menu:create')" class="flex shrink-0 items-center justify-end gap-2 border-b border-default px-4 py-3">
      <UButton icon="i-lucide-panels-top-left" label="新建分组" color="neutral" variant="outline" @click="openMenuForm(undefined, undefined, 'group')" />
      <UButton icon="i-lucide-plus" label="新建菜单" @click="openMenuForm()" />
    </div>

    <UTable
      v-model:column-pinning="columnPinning"
      :data="flatRows"
      :columns="menuColumns"
      :meta="menuTableMeta"
      :loading="loading"
      :ui="{ th: 'whitespace-nowrap' }"
      sticky="header"
      class="min-h-0 flex-1"
    >
      <template #title-cell="{ row }">
        <div class="flex items-center gap-2" :style="{ paddingInlineStart: `${row.original.depth * 20}px` }">
          <UButton
            v-if="row.original.children?.length"
            :icon="expandedIds.has(row.original.id) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
            size="xs"
            color="neutral"
            variant="ghost"
            @click="toggleExpanded(row.original.id)"
          />
          <span v-else class="inline-block size-6" />
          <template v-if="menuTreeShowsIcon(row.original)">
            <UIcon v-if="typeof row.original.icon === 'string' && row.original.icon.startsWith('i-')" :name="row.original.icon" class="size-4 text-muted" />
            <picture v-else-if="isMenuImageIcon(row.original.icon)" class="size-4 shrink-0">
              <source media="(prefers-color-scheme: dark)" :srcset="getMenuImageIcon(row.original.icon, 'dark')" />
              <img :src="getMenuImageIcon(row.original.icon)" alt="" class="size-4 object-contain" />
            </picture>
            <UIcon v-else :name="menuTypeIcon(row.original.type)" class="size-4 text-muted" />
          </template>
          <span v-else class="size-4 shrink-0" aria-hidden="true" />
          <span :class="row.original.type === 'group' ? 'font-semibold text-highlighted' : 'font-medium text-default'">{{ row.original.title }}</span>
          <UBadge v-if="row.original.descendantCount" :label="`${row.original.descendantCount} 个后代`" color="neutral" variant="subtle" size="sm" />
        </div>
      </template>
      <template #type-cell="{ row }"><UBadge :label="menuTypeLabel(row.original.type)" :color="menuTypeColor(row.original.type)" variant="subtle" /></template>
      <template #path-cell="{ row }">
        <code v-if="row.original.type !== 'group'" class="text-xs text-muted">{{ menuTablePath(row.original) }}</code>
        <span v-else aria-hidden="true" />
      </template>
      <template #accessScope-cell="{ row }">
        <UBadge
          v-if="row.original.type !== 'group'"
          :label="row.original.accessScope === 'public' ? '公共' : '受限'"
          :color="row.original.accessScope === 'public' ? 'neutral' : 'primary'"
          variant="subtle"
        />
        <span v-else aria-hidden="true" />
      </template>
      <template #status-cell="{ row }">
        <UBadge :label="row.original.status === 'ENABLED' ? '启用' : '禁用'" :color="row.original.status === 'ENABLED' ? 'success' : 'neutral'" variant="subtle" />
      </template>
      <template #actions-cell="{ row }">
        <div class="flex justify-end gap-1">
          <UButton
            v-if="row.original.type !== 'button' && accessStore.hasPermission('system:menu:create')"
            icon="i-lucide-list-plus"
            aria-label="添加子节点"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="openMenuForm(undefined, row.original.id)"
          />
          <UButton
            v-if="accessStore.hasPermission('system:menu:update')"
            icon="i-lucide-pencil"
            aria-label="编辑菜单节点"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="openMenuForm(row.original)"
          />
          <UButton
            v-if="accessStore.hasPermission('system:menu:delete')"
            icon="i-lucide-trash-2"
            aria-label="删除菜单节点"
            color="error"
            variant="ghost"
            size="sm"
            @click="requestDeleteMenu(row.original)"
          />
        </div>
      </template>
      <template #empty><UEmpty icon="i-lucide-list-tree" title="暂无菜单" description="创建第一个分组或菜单节点。" /></template>
    </UTable>
  </div>

  <USlideover
    v-model:open="menuSlideoverOpen"
    :title="editingMenu ? '编辑菜单节点' : '新建菜单节点'"
    description="分组只负责组织、排序和启停；普通菜单继续参与路由与角色授权。"
    :ui="{ content: 'sm:max-w-2xl' }"
  >
    <template #body>
      <UForm id="menu-form" :schema="menuSchema" :state="menuForm" class="space-y-4" @submit="saveMenu">
        <div>
          <h3 class="text-sm font-semibold text-highlighted">基本配置</h3>
          <p class="mt-1 text-xs text-muted">设置节点类型、层级和显示顺序。</p>
        </div>
        <UFormField name="id" label="节点 ID" required><UInput v-model="menuForm.id" :disabled="Boolean(editingMenu)" class="w-full" /></UFormField>
        <UFormField name="title" label="标题" required><UInput v-model="menuForm.title" class="w-full" /></UFormField>
        <UFormField name="type" label="类型" required>
          <USelect
            v-model="menuForm.type"
            :items="[
              { label: '分组', value: 'group' },
              { label: '目录', value: 'directory' },
              { label: '菜单', value: 'menu' },
              { label: '按钮', value: 'button' },
            ]"
            class="w-full"
          />
        </UFormField>

        <UAlert
          v-if="menuForm.type === 'group'"
          color="neutral"
          variant="subtle"
          icon="i-lucide-info"
          title="分组是非路由节点"
          description="分组只能位于顶层，不参与角色授权；禁用后会隐藏其全部菜单。"
        />

        <template v-else>
          <div v-if="menuSupportsIcon" class="grid gap-4 sm:grid-cols-2">
            <UFormField name="iconKind" label="图标类型">
              <USelect
                v-model="menuForm.iconKind"
                :items="[
                  { label: 'Iconify 图标', value: 'iconify' },
                  { label: '图片图标', value: 'image' },
                ]"
                class="w-full"
              />
            </UFormField>
            <UFormField v-if="menuForm.iconKind === 'iconify'" name="icon" label="图标" description="使用 i-{collection}-{name} 格式，例如 i-lucide-settings。">
              <UInput v-model="menuForm.icon" placeholder="i-lucide-settings" class="w-full">
                <template v-if="menuForm.icon.startsWith('i-')" #leading><UIcon :name="menuForm.icon" class="size-4" /></template>
              </UInput>
            </UFormField>
          </div>
          <div v-if="menuSupportsIcon && menuForm.iconKind === 'image'" class="grid gap-4 sm:grid-cols-2">
            <UFormField name="iconLight" label="亮色图片地址" required><UInput v-model="menuForm.iconLight" placeholder="https://example.com/icon-light.png" class="w-full" /></UFormField>
            <UFormField name="iconDark" label="暗色图片地址" hint="可选"><UInput v-model="menuForm.iconDark" placeholder="https://example.com/icon-dark.png" class="w-full" /></UFormField>
          </div>
          <UAlert
            v-if="menuHasRoute && !menuSupportsIcon"
            color="neutral"
            variant="subtle"
            icon="i-lucide-info"
            title="三级菜单不支持图标"
            description="分组层级不计入菜单深度；第三级菜单仅显示标题。"
          />
          <UFormField name="parentId" label="父节点"><USelect v-model="menuForm.parentId" :items="parentOptions" class="w-full" /></UFormField>
          <UFormField
            name="path"
            :label="menuForm.type === 'button' ? '按钮路径' : '路由路径'"
            required
            :description="!menuForm.parentId || parentIsGroup ? '根菜单使用 / 开头的绝对路径。' : '子节点使用相对路径。'"
          >
            <UInput
              v-model="menuForm.path"
              class="w-full"
              :ui="parentRoutePath ? { base: 'font-mono ps-[calc(0.625rem+var(--menu-path-prefix-width))]', leading: 'pointer-events-none ps-2.5 font-mono text-muted' } : { base: 'font-mono' }"
              :style="parentRoutePath ? { '--menu-path-prefix-width': `${parentRoutePrefix.length}ch` } : undefined"
            >
              <template v-if="parentRoutePath" #leading>
                <span class="select-none whitespace-nowrap">{{ parentRoutePrefix }}</span>
              </template>
            </UInput>
          </UFormField>
          <UFormField v-if="menuForm.type === 'button'" name="permissionCode" label="权限码" required>
            <UInput v-model="menuForm.permissionCode" placeholder="system:menu:create" class="w-full" />
          </UFormField>
          <UFormField name="accessScope" label="访问范围" required>
            <URadioGroup
              v-model="menuForm.accessScope"
              :items="[
                { label: '受限', value: 'restricted', description: '默认仅 admin 可见，可在角色管理中继续授权。' },
                { label: '公共', value: 'public', description: '所有已登录用户可见且不可在角色授权中取消。' },
              ]"
            />
          </UFormField>
        </template>

        <div class="grid grid-cols-2 gap-4">
          <UFormField name="status" label="状态">
            <USelect
              v-model="menuForm.status"
              :items="[
                { label: '启用', value: 'ENABLED' },
                { label: '禁用', value: 'DISABLED' },
              ]"
              class="w-full"
            />
          </UFormField>
          <UFormField name="order" :label="menuForm.type === 'group' ? '分组排序' : '排序'"><UInputNumber v-model="menuForm.order" class="w-full" /></UFormField>
        </div>
        <UFormField name="description" label="描述"><UTextarea v-model="menuForm.description" autoresize class="w-full" /></UFormField>

        <template v-if="menuHasRoute">
          <div class="border-t border-default pt-4">
            <h3 class="text-sm font-semibold text-highlighted">跳转配置</h3>
            <p class="mt-1 text-xs text-muted">外部链接与 iframe 地址互斥；未填写时使用节点路由路径。</p>
          </div>
          <UFormField name="activePath" label="菜单高亮路径" description="访问当前页面时需要高亮的菜单绝对路径。">
            <UInput v-model="menuForm.activePath" placeholder="/system/settings" class="w-full" />
          </UFormField>
          <UFormField name="externalLink" label="外部链接" description="点击菜单后在新窗口打开。">
            <UInput v-model="menuForm.externalLink" type="url" placeholder="https://example.com" class="w-full" />
          </UFormField>
          <UFormField name="iframeSrc" label="iframe 地址" description="在后台内容区内嵌显示。">
            <UInput v-model="menuForm.iframeSrc" type="url" placeholder="https://example.com/docs" class="w-full" />
          </UFormField>
          <UFormField name="tabPath" label="复用 Tab 路径" description="多个页面复用同一个 Tab 时填写对应的绝对路径。">
            <UInput v-model="menuForm.tabPath" :disabled="menuForm.hideInTab" placeholder="/system/settings" class="w-full" />
          </UFormField>

          <div class="border-t border-default pt-4">
            <h3 class="text-sm font-semibold text-highlighted">显示与缓存</h3>
            <p class="mt-1 text-xs text-muted">控制菜单、面包屑和 Tab 的展示行为。</p>
          </div>
          <div class="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <UFormField name="hideInBreadcrumb"><USwitch v-model="menuForm.hideInBreadcrumb" label="在面包屑中隐藏" description="不生成当前节点的面包屑。" /></UFormField>
            <UFormField name="hideInMenu"><USwitch v-model="menuForm.hideInMenu" label="在菜单中隐藏" description="保留路由，但不显示菜单项。" /></UFormField>
            <UFormField name="hideInTab"><USwitch v-model="menuForm.hideInTab" label="在 Tab 中隐藏" description="访问页面时不创建 Tab。" /></UFormField>
            <UFormField name="keepAlive"><USwitch v-model="menuForm.keepAlive" :disabled="menuForm.hideInTab" label="缓存页面状态" description="切换 Tab 后保留页面或 iframe 状态。" /></UFormField>
            <UFormField name="menuVisibleWithForbidden" class="sm:col-span-2">
              <USwitch
                v-model="menuForm.menuVisibleWithForbidden"
                :disabled="menuForm.accessScope === 'public'"
                label="无权限时仍显示菜单"
                description="仅受限菜单有效；无权限用户点击后显示 403 页面。"
              />
            </UFormField>
          </div>
        </template>
      </UForm>
    </template>
    <template #footer="{ close }"><UButton label="取消" color="neutral" variant="outline" @click="close" /><UButton type="submit" form="menu-form" label="保存" :loading="saving" /></template>
  </USlideover>

  <UModal
    v-model:open="deleteMenuOpen"
    :title="deletingMenu?.type === 'group' ? '删除菜单分组' : '删除菜单子树'"
    :description="
      deletingMenu
        ? deletingMenu.type === 'group'
          ? deletingMenu.children?.length
            ? `分组“${deletingMenu.title}”仍包含 ${countMenuSubtree(deletingMenu) - 1} 个菜单节点，服务端会拒绝删除；请先移动或删除这些菜单。`
            : `将删除空分组“${deletingMenu.title}”。此操作不可撤销。`
          : `将永久删除“${deletingMenu.title}”及其全部后代，共 ${countMenuSubtree(deletingMenu)} 个节点，同时移除所有角色关联。此操作不可撤销。`
        : ''
    "
    :ui="{ footer: 'justify-end' }"
  >
    <template #footer="{ close }">
      <UButton label="取消" color="neutral" variant="outline" @click="close" />
      <UButton label="确认删除" color="error" :disabled="deletingMenu?.type === 'group' && Boolean(deletingMenu.children?.length)" :loading="saving" @click="confirmDeleteMenu" />
    </template>
  </UModal>
</template>
