export type LayoutType = 'sidebar-nav' | 'header-nav'

export type ThemeModeType = 'auto' | 'dark' | 'light'

export type AdminMenuAuthority = string | string[]

export interface AdminMenuImageIcon {
  dark?: string
  light: string
}

export type AdminMenuIcon = AdminMenuImageIcon | string

export interface AdminRouteMeta {
  activePath?: string
  authority?: AdminMenuAuthority
  externalLink?: string
  hideInBreadcrumb?: boolean
  hideInMenu?: boolean
  hideInTab?: boolean
  icon?: AdminMenuIcon
  menuGroup?: AdminMenuGroupMeta | string
  order?: number
  title?: string
}

export interface AdminBreadcrumbItem {
  icon?: AdminMenuIcon
  path?: string
  title: string
}

export interface AdminMenuItem {
  active?: boolean
  activePath?: string
  authority?: AdminMenuAuthority
  children?: AdminMenuItem[]
  externalLink?: string
  icon?: AdminMenuIcon
  id: string
  order?: number
  path: string
  title: string
}

export interface AdminMenuGroupMeta {
  id?: string
  label: string
  order?: number
}

export interface AdminMenuGroup {
  children: AdminMenuItem[]
  id: string
  label?: string
  order?: number
}

export interface AdminTabItem {
  active?: boolean
  closable?: boolean
  icon?: AdminMenuIcon
  path: string
  title: string
}

export type LayoutRouteMeta = AdminRouteMeta
export type LayoutMenuItem = AdminMenuItem
export type LayoutMenuGroup = AdminMenuGroup
export type LayoutBreadcrumbItem = AdminBreadcrumbItem
