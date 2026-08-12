import type { SystemMenuApi } from '@/api/core/system'

export type MenuNodeType = SystemMenuApi.Node['type']
export type MenuStatus = SystemMenuApi.Node['status']
export type MenuAccessScope = SystemMenuApi.Node['accessScope']

type BadgeColor = 'error' | 'info' | 'neutral' | 'primary' | 'success' | 'warning'

type MenuEnumMetadata = {
  label: string
  color: BadgeColor
  description: string
}

function enumValues<const Metadata extends Record<string, MenuEnumMetadata>>(metadata: Metadata) {
  return Object.keys(metadata) as [keyof Metadata & string, ...(keyof Metadata & string)[]]
}

function enumOptions<const Metadata extends Record<string, MenuEnumMetadata>>(metadata: Metadata) {
  return enumValues(metadata).map((value) => ({ value, ...metadata[value] }))
}

export const menuTypeMetadata = {
  group: {
    label: '分组',
    color: 'warning',
    description: '仅组织顶层菜单，不生成路由。',
  },
  directory: {
    label: '目录',
    color: 'info',
    description: '承载子路由的导航节点。',
  },
  menu: {
    label: '菜单',
    color: 'primary',
    description: '可访问的页面路由。',
  },
  button: {
    label: '按钮',
    color: 'neutral',
    description: '页面内操作对应的权限节点。',
  },
} satisfies Record<MenuNodeType, MenuEnumMetadata>

export const menuStatusMetadata = {
  ENABLED: {
    label: '启用',
    color: 'success',
    description: '节点及其可用后代正常生效。',
  },
  DISABLED: {
    label: '禁用',
    color: 'neutral',
    description: '节点及其后代不会出现在导航中。',
  },
} satisfies Record<MenuStatus, MenuEnumMetadata>

export const menuAccessScopeMetadata = {
  restricted: {
    label: '受限',
    color: 'primary',
    description: '默认仅 admin 可见，可在角色管理中继续授权。',
  },
  public: {
    label: '公共',
    color: 'neutral',
    description: '所有已登录用户可见且不可在角色授权中取消。',
  },
} satisfies Record<MenuAccessScope, MenuEnumMetadata>

export const menuTypeFallbackIcons = {
  group: 'i-lucide-panels-top-left',
  directory: 'i-lucide-folder',
  menu: 'i-lucide-file',
  button: 'i-lucide-mouse-pointer-click',
} satisfies Record<MenuNodeType, string>

export const menuTypeValues = enumValues(menuTypeMetadata)
export const menuStatusValues = enumValues(menuStatusMetadata)
export const menuAccessScopeValues = enumValues(menuAccessScopeMetadata)

export const menuTypeOptions = enumOptions(menuTypeMetadata)
export const menuStatusOptions = enumOptions(menuStatusMetadata)
export const menuAccessScopeOptions = enumOptions(menuAccessScopeMetadata)

export function getMenuTypeMetadata(type: MenuNodeType) {
  return menuTypeMetadata[type]
}

export function getMenuTypeFallbackIcon(type: MenuNodeType) {
  return menuTypeFallbackIcons[type]
}

export function getMenuStatusMetadata(status: MenuStatus) {
  return menuStatusMetadata[status]
}

export function getMenuAccessScopeMetadata(accessScope: MenuAccessScope) {
  return menuAccessScopeMetadata[accessScope]
}
