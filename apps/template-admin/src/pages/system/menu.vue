<script setup lang="ts">
import type { FormSubmitEvent, TableColumn } from '@nuxt/ui'
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

const accessStore = useAdminAccessStore()
const toast = useToast()
const loading = ref(false)
const saving = ref(false)
const groups = ref<SystemMenuApi.Group[]>([])
const tree = ref<SystemMenuApi.Node[]>([])
const expandedIds = ref(new Set<string>())
const activeTab = ref('menus')

const menuSlideoverOpen = ref(false)
const editingMenu = ref<SystemMenuApi.Node | null>(null)
const menuForm = reactive({
  id: '',
  title: '',
  type: 'menu' as 'directory' | 'menu' | 'button',
  parentId: null as string | null,
  groupId: null as string | null,
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

const groupSlideoverOpen = ref(false)
const editingGroup = ref<SystemMenuApi.Group | null>(null)
const groupForm = reactive({ id: '', label: '', order: 0, status: 'ENABLED' as 'ENABLED' | 'DISABLED' })

const deleteMenuOpen = ref(false)
const deletingMenu = ref<SystemMenuApi.Node | null>(null)
const deleteGroupOpen = ref(false)
const deletingGroup = ref<SystemMenuApi.Group | null>(null)

const menuSchema = z
  .object({
    id: z
      .string()
      .min(1, '请输入菜单 ID')
      .regex(/^[a-z0-9_-]+$/, '只能包含小写字母、数字、下划线和连字符'),
    title: z.string().min(1, '请输入标题'),
    type: z.enum(['directory', 'menu', 'button']),
    path: z.string().min(1, '请输入路径'),
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
    if (value.type === 'button' && !value.permissionCode.trim()) ctx.addIssue({ code: 'custom', path: ['permissionCode'], message: '按钮必须填写权限码' })
    if (value.type !== 'button' && value.iconKind === 'image' && !value.iconLight.trim()) ctx.addIssue({ code: 'custom', path: ['iconLight'], message: '图片图标必须填写亮色图片地址' })
    if (value.type !== 'button' && value.externalLink.trim() && value.iframeSrc.trim()) {
      ctx.addIssue({ code: 'custom', path: ['externalLink'], message: '外部链接和 iframe 地址不能同时设置' })
      ctx.addIssue({ code: 'custom', path: ['iframeSrc'], message: 'iframe 地址和外部链接不能同时设置' })
    }
    if (value.type !== 'button' && value.activePath.trim() && !value.activePath.trim().startsWith('/')) ctx.addIssue({ code: 'custom', path: ['activePath'], message: '高亮路径必须以 / 开头' })
    if (value.type !== 'button' && !value.hideInTab && value.tabPath.trim() && !value.tabPath.trim().startsWith('/'))
      ctx.addIssue({ code: 'custom', path: ['tabPath'], message: 'Tab 路径必须以 / 开头' })
  })

const groupSchema = z.object({
  id: z
    .string()
    .min(1, '请输入分组 ID')
    .regex(/^[a-z0-9_-]+$/, '只能包含小写字母、数字、下划线和连字符'),
  label: z.string().min(1, '请输入分组标题'),
})

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
const parentOptions = computed(() => [
  { label: '无（根节点）', value: null },
  ...allMenuNodes.value.filter((node) => node.type !== 'button' && node.id !== editingMenu.value?.id).map((node) => ({ label: `${'　'.repeat(node.depth)}${node.title}`, value: node.id })),
])
const groupOptions = computed(() => [{ label: '不分组', value: null }, ...groups.value.map((group) => ({ label: group.label, value: group.id }))])

const menuColumns: TableColumn<SystemMenuApi.Node & { depth: number; descendantCount: number }>[] = [
  { accessorKey: 'title', header: '节点' },
  { accessorKey: 'type', header: '类型' },
  { accessorKey: 'path', header: '路径 / 权限码' },
  { accessorKey: 'accessScope', header: '访问范围' },
  { accessorKey: 'status', header: '状态' },
  { id: 'actions', header: '操作' },
]

const groupColumns: TableColumn<SystemMenuApi.Group>[] = [
  { accessorKey: 'label', header: '分组' },
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'order', header: '排序' },
  { accessorKey: 'status', header: '状态' },
  { id: 'actions', header: '操作' },
]

function menuTypeLabel(type: string) {
  return type === 'directory' ? '目录' : type === 'button' ? '按钮' : '菜单'
}

function isMenuImageIcon(icon: unknown): icon is { dark?: string; light: string } {
  return typeof icon === 'object' && icon !== null && !Array.isArray(icon) && 'light' in icon && typeof icon.light === 'string'
}

async function loadData() {
  const requestSessionVersion = accessStore.sessionVersion
  loading.value = true
  try {
    const [nextGroups, nextTree] = await Promise.all([systemMenuApi.listGroups(), systemMenuApi.getTree()])
    groups.value = nextGroups
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

function openMenuForm(menu?: SystemMenuApi.Node, parentId?: string) {
  editingMenu.value = menu ?? null
  const icon = menu?.icon
  const imageIcon = isMenuImageIcon(icon) ? icon : null
  Object.assign(menuForm, {
    id: menu?.id ?? '',
    title: menu?.title ?? '',
    type: menu?.type ?? 'menu',
    parentId: menu?.parentId ?? parentId ?? null,
    groupId: menu?.groupId ?? null,
    path: menu?.path ?? '',
    accessScope: menu?.accessScope ?? 'restricted',
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
  const hasRoute = menuForm.type !== 'button'
  const icon = hasRoute
    ? menuForm.iconKind === 'image'
      ? { light: menuForm.iconLight.trim(), ...(menuForm.iconDark.trim() ? { dark: menuForm.iconDark.trim() } : {}) }
      : menuForm.icon.trim() || null
    : null
  const body = {
    title: event.data.title,
    type: event.data.type,
    path: event.data.path,
    parentId: menuForm.parentId,
    groupId: menuForm.parentId ? null : menuForm.groupId,
    accessScope: menuForm.accessScope,
    status: menuForm.status,
    order: menuForm.order,
    permissionCode: menuForm.type === 'button' ? menuForm.permissionCode : null,
    description: menuForm.description || null,
    icon,
    activePath: hasRoute ? menuForm.activePath.trim() || null : null,
    externalLink: hasRoute ? menuForm.externalLink.trim() || null : null,
    iframeSrc: hasRoute ? menuForm.iframeSrc.trim() || null : null,
    hideInBreadcrumb: hasRoute && menuForm.hideInBreadcrumb,
    hideInMenu: hasRoute && menuForm.hideInMenu,
    hideInTab: hasRoute && menuForm.hideInTab,
    keepAlive: hasRoute && !menuForm.hideInTab && menuForm.keepAlive,
    menuVisibleWithForbidden: hasRoute && menuForm.accessScope === 'restricted' && menuForm.menuVisibleWithForbidden,
    tabPath: hasRoute && !menuForm.hideInTab ? menuForm.tabPath.trim() || null : null,
  }
  try {
    if (editingMenu.value) await systemMenuApi.update(editingMenu.value.id, body)
    else await systemMenuApi.create({ id: event.data.id, ...body })
    menuSlideoverOpen.value = false
    toast.add({ title: editingMenu.value ? '菜单已更新' : '菜单已创建', color: 'success', icon: 'i-lucide-circle-check' })
    await loadData()
  } catch (error) {
    toast.add({ title: '保存菜单失败', description: getApiErrorMessage(error), color: 'error' })
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
    toast.add({ title: '菜单已删除', description: `共删除 ${result.deletedCount} 个节点。`, color: 'success' })
    await loadData()
  } catch (error) {
    toast.add({ title: '删除菜单失败', description: getApiErrorMessage(error), color: 'error' })
  } finally {
    saving.value = false
  }
}

function openGroupForm(group?: SystemMenuApi.Group) {
  editingGroup.value = group ?? null
  Object.assign(groupForm, { id: group?.id ?? '', label: group?.label ?? '', order: group?.order ?? 0, status: group?.status ?? 'ENABLED' })
  groupSlideoverOpen.value = true
}

async function saveGroup(event: FormSubmitEvent<z.output<typeof groupSchema>>) {
  saving.value = true
  try {
    const body = { label: event.data.label, order: groupForm.order, status: groupForm.status }
    if (editingGroup.value) await systemMenuApi.updateGroup(editingGroup.value.id, body)
    else await systemMenuApi.createGroup({ id: event.data.id, ...body })
    groupSlideoverOpen.value = false
    toast.add({ title: editingGroup.value ? '分组已更新' : '分组已创建', color: 'success' })
    await loadData()
  } catch (error) {
    toast.add({ title: '保存分组失败', description: getApiErrorMessage(error), color: 'error' })
  } finally {
    saving.value = false
  }
}

function requestDeleteGroup(group: SystemMenuApi.Group) {
  deletingGroup.value = group
  deleteGroupOpen.value = true
}

async function confirmDeleteGroup() {
  if (!deletingGroup.value) return
  saving.value = true
  try {
    await systemMenuApi.deleteGroup(deletingGroup.value.id)
    deleteGroupOpen.value = false
    toast.add({ title: '菜单分组已删除', color: 'success' })
    await loadData()
  } catch (error) {
    toast.add({ title: '删除分组失败', description: getApiErrorMessage(error), color: 'error' })
  } finally {
    saving.value = false
  }
}

onMounted(loadData)
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <div class="flex shrink-0 items-center justify-between gap-3 border-b border-default px-4 py-3">
      <UTabs
        v-model="activeTab"
        :content="false"
        :items="[
          { label: '菜单树', value: 'menus', icon: 'i-lucide-list-tree' },
          { label: '菜单分组', value: 'groups', icon: 'i-lucide-panels-top-left' },
        ]"
        class="w-fit shrink-0"
      />

      <div class="shrink-0">
        <UButton v-if="activeTab === 'menus' && accessStore.hasPermission('system:menu:create')" icon="i-lucide-plus" label="新建菜单" @click="openMenuForm()" />
        <UButton v-if="activeTab === 'groups' && accessStore.hasPermission('system:menu-group:create')" icon="i-lucide-plus" label="新建分组" @click="openGroupForm()" />
      </div>
    </div>

    <UTable v-if="activeTab === 'menus'" :data="flatRows" :columns="menuColumns" :loading="loading" sticky="header" class="min-h-0 flex-1">
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
          <UIcon :name="row.original.type === 'button' ? 'i-lucide-mouse-pointer-click' : row.original.type === 'directory' ? 'i-lucide-folder' : 'i-lucide-file'" class="size-4 text-muted" />
          <span class="font-medium text-default">{{ row.original.title }}</span>
          <UBadge v-if="row.original.descendantCount" :label="`${row.original.descendantCount} 个后代`" color="neutral" variant="subtle" size="sm" />
        </div>
      </template>
      <template #type-cell="{ row }"><UBadge :label="menuTypeLabel(row.original.type)" color="neutral" variant="subtle" /></template>
      <template #path-cell="{ row }"
        ><code class="text-xs text-muted">{{ row.original.type === 'button' ? row.original.permissionCode : row.original.path }}</code></template
      >
      <template #accessScope-cell="{ row }"
        ><UBadge :label="row.original.accessScope === 'public' ? '公共' : '受限'" :color="row.original.accessScope === 'public' ? 'neutral' : 'primary'" variant="subtle"
      /></template>
      <template #status-cell="{ row }"
        ><UBadge :label="row.original.status === 'ENABLED' ? '启用' : '禁用'" :color="row.original.status === 'ENABLED' ? 'success' : 'neutral'" variant="subtle"
      /></template>
      <template #actions-cell="{ row }">
        <div class="flex justify-end gap-1">
          <UButton
            v-if="row.original.type !== 'button' && accessStore.hasPermission('system:menu:create')"
            icon="i-lucide-list-plus"
            aria-label="添加子节点"
            color="neutral"
            variant="ghost"
            @click="openMenuForm(undefined, row.original.id)"
          />
          <UButton v-if="accessStore.hasPermission('system:menu:update')" icon="i-lucide-pencil" aria-label="编辑菜单" color="neutral" variant="ghost" @click="openMenuForm(row.original)" />
          <UButton v-if="accessStore.hasPermission('system:menu:delete')" icon="i-lucide-trash-2" aria-label="删除菜单" color="error" variant="ghost" @click="requestDeleteMenu(row.original)" />
        </div>
      </template>
      <template #empty><UEmpty icon="i-lucide-list-tree" title="暂无菜单" description="创建第一个菜单节点。" /></template>
    </UTable>

    <UTable v-else :data="groups" :columns="groupColumns" :loading="loading" sticky="header" class="min-h-0 flex-1">
      <template #status-cell="{ row }"
        ><UBadge :label="row.original.status === 'ENABLED' ? '启用' : '禁用'" :color="row.original.status === 'ENABLED' ? 'success' : 'neutral'" variant="subtle"
      /></template>
      <template #actions-cell="{ row }">
        <div class="flex justify-end gap-1">
          <UButton v-if="accessStore.hasPermission('system:menu-group:update')" icon="i-lucide-pencil" aria-label="编辑分组" color="neutral" variant="ghost" @click="openGroupForm(row.original)" />
          <UButton v-if="accessStore.hasPermission('system:menu-group:delete')" icon="i-lucide-trash-2" aria-label="删除分组" color="error" variant="ghost" @click="requestDeleteGroup(row.original)" />
        </div>
      </template>
      <template #empty><UEmpty icon="i-lucide-panels-top-left" title="暂无菜单分组" /></template>
    </UTable>
  </div>

  <USlideover
    v-model:open="menuSlideoverOpen"
    :title="editingMenu ? '编辑菜单节点' : '新建菜单节点'"
    description="ID 创建后不可修改。公共节点不绑定角色；受限节点至少保留 admin。"
    :ui="{ content: 'sm:max-w-2xl' }"
  >
    <template #body>
      <UForm id="menu-form" :schema="menuSchema" :state="menuForm" class="space-y-4" @submit="saveMenu">
        <div>
          <h3 class="text-sm font-semibold text-highlighted">基本配置</h3>
          <p class="mt-1 text-xs text-muted">设置节点层级、路由信息和访问权限。</p>
        </div>
        <UFormField name="id" label="节点 ID" required><UInput v-model="menuForm.id" :disabled="Boolean(editingMenu)" class="w-full" /></UFormField>
        <UFormField name="title" label="标题" required><UInput v-model="menuForm.title" class="w-full" /></UFormField>
        <UFormField name="type" label="类型" required
          ><USelect
            v-model="menuForm.type"
            :items="[
              { label: '目录', value: 'directory' },
              { label: '菜单', value: 'menu' },
              { label: '按钮', value: 'button' },
            ]"
            class="w-full"
        /></UFormField>
        <div v-if="menuForm.type !== 'button'" class="grid gap-4 sm:grid-cols-2">
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
        <div v-if="menuForm.type !== 'button' && menuForm.iconKind === 'image'" class="grid gap-4 sm:grid-cols-2">
          <UFormField name="iconLight" label="亮色图片地址" required><UInput v-model="menuForm.iconLight" placeholder="https://example.com/icon-light.png" class="w-full" /></UFormField>
          <UFormField name="iconDark" label="暗色图片地址" hint="可选"><UInput v-model="menuForm.iconDark" placeholder="https://example.com/icon-dark.png" class="w-full" /></UFormField>
        </div>
        <UFormField name="parentId" label="父节点"><USelect v-model="menuForm.parentId" :items="parentOptions" class="w-full" /></UFormField>
        <UFormField v-if="!menuForm.parentId" name="groupId" label="菜单分组"><USelect v-model="menuForm.groupId" :items="groupOptions" class="w-full" /></UFormField>
        <UFormField name="path" :label="menuForm.type === 'button' ? '按钮路径' : '路由路径'" required description="根节点使用 / 开头的绝对路径，子节点使用相对路径。"
          ><UInput v-model="menuForm.path" class="w-full"
        /></UFormField>
        <UFormField v-if="menuForm.type === 'button'" name="permissionCode" label="权限码" required
          ><UInput v-model="menuForm.permissionCode" placeholder="system:menu:create" class="w-full"
        /></UFormField>
        <UFormField name="accessScope" label="访问范围" required
          ><URadioGroup
            v-model="menuForm.accessScope"
            :items="[
              { label: '受限', value: 'restricted', description: '默认仅 admin 可见，可在角色管理中继续授权。' },
              { label: '公共', value: 'public', description: '所有已登录用户可见且不可在角色授权中取消。' },
            ]"
        /></UFormField>
        <div class="grid grid-cols-2 gap-4">
          <UFormField name="status" label="状态"
            ><USelect
              v-model="menuForm.status"
              :items="[
                { label: '启用', value: 'ENABLED' },
                { label: '禁用', value: 'DISABLED' },
              ]"
              class="w-full"
          /></UFormField>
          <UFormField name="order" label="排序"><UInputNumber v-model="menuForm.order" class="w-full" /></UFormField>
        </div>
        <UFormField name="description" label="描述"><UTextarea v-model="menuForm.description" autoresize class="w-full" /></UFormField>

        <template v-if="menuForm.type !== 'button'">
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
            <UFormField name="hideInBreadcrumb">
              <USwitch v-model="menuForm.hideInBreadcrumb" label="在面包屑中隐藏" description="不生成当前节点的面包屑。" />
            </UFormField>
            <UFormField name="hideInMenu">
              <USwitch v-model="menuForm.hideInMenu" label="在菜单中隐藏" description="保留路由，但不显示菜单项。" />
            </UFormField>
            <UFormField name="hideInTab">
              <USwitch v-model="menuForm.hideInTab" label="在 Tab 中隐藏" description="访问页面时不创建 Tab。" />
            </UFormField>
            <UFormField name="keepAlive">
              <USwitch v-model="menuForm.keepAlive" :disabled="menuForm.hideInTab" label="缓存页面状态" description="切换 Tab 后保留页面或 iframe 状态。" />
            </UFormField>
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

  <USlideover v-model:open="groupSlideoverOpen" :title="editingGroup ? '编辑菜单分组' : '新建菜单分组'" description="禁用分组会从访问响应中隐藏其完整菜单树。">
    <template #body>
      <UForm id="group-form" :schema="groupSchema" :state="groupForm" class="space-y-4" @submit="saveGroup">
        <UFormField name="id" label="分组 ID" required><UInput v-model="groupForm.id" :disabled="Boolean(editingGroup)" class="w-full" /></UFormField>
        <UFormField name="label" label="标题" required><UInput v-model="groupForm.label" class="w-full" /></UFormField>
        <UFormField name="order" label="排序"><UInputNumber v-model="groupForm.order" class="w-full" /></UFormField>
        <UFormField name="status" label="状态"
          ><USelect
            v-model="groupForm.status"
            :items="[
              { label: '启用', value: 'ENABLED' },
              { label: '禁用', value: 'DISABLED' },
            ]"
            class="w-full"
        /></UFormField>
      </UForm>
    </template>
    <template #footer="{ close }"><UButton label="取消" color="neutral" variant="outline" @click="close" /><UButton type="submit" form="group-form" label="保存" :loading="saving" /></template>
  </USlideover>

  <UModal
    v-model:open="deleteMenuOpen"
    title="删除菜单子树"
    :description="deletingMenu ? `将永久删除“${deletingMenu.title}”及其全部后代，共 ${countMenuSubtree(deletingMenu)} 个节点，同时移除所有角色关联。此操作不可撤销。` : ''"
    :ui="{ footer: 'justify-end' }"
  >
    <template #footer="{ close }"
      ><UButton label="取消" color="neutral" variant="outline" @click="close" /><UButton label="确认删除" color="error" :loading="saving" @click="confirmDeleteMenu"
    /></template>
  </UModal>

  <UModal
    v-model:open="deleteGroupOpen"
    title="删除菜单分组"
    :description="deletingGroup ? `将删除分组“${deletingGroup.label}”。仍被任何菜单引用时，服务端会拒绝删除。` : ''"
    :ui="{ footer: 'justify-end' }"
  >
    <template #footer="{ close }"
      ><UButton label="取消" color="neutral" variant="outline" @click="close" /><UButton label="确认删除" color="error" :loading="saving" @click="confirmDeleteGroup"
    /></template>
  </UModal>
</template>
