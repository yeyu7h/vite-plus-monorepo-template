export type LayoutType = 'sidebar-nav' | 'header-nav'

export type ThemeModeType = 'auto' | 'dark' | 'light'

export type AdminMenuAuthority = string[]

export interface AdminMenuImageIcon {
  /** 暗色主题下展示的图标地址 */
  dark?: string
  /** 亮色主题下展示的图标地址 */
  light: string
}

export type AdminMenuIcon = AdminMenuImageIcon | string

export interface AdminRouteMeta {
  /** 指定当前路由高亮时对应的菜单路径 */
  activePath?: string
  /** 声明访问该路由项所需的权限标识 */
  authority?: AdminMenuAuthority
  /** 将菜单跳转目标替换为外部链接地址 */
  externalLink?: string
  /** 在自动生成的面包屑中隐藏该路由 */
  hideInBreadcrumb?: boolean
  /** 在自动生成的菜单中隐藏该路由 */
  hideInMenu?: boolean
  /** 复用父级标签页，而不是为该路由单独打开标签页 */
  hideInTab?: boolean
  /** 定义该路由在菜单、面包屑和标签页中显示的图标 */
  icon?: AdminMenuIcon
  /** 指定该路由所属的菜单分组，并可配置分组标题和排序 */
  menuGroup?: AdminMenuGroupMeta | string
  /** 控制菜单项或菜单分组的升序排序权重 */
  order?: number
  /** 提供导航相关 UI 使用的显示标题 */
  title?: string
}

export interface AdminNavigationRouteRecord {
  /** Vue Router 为当前路由匹配到的路由链 */
  matched?: readonly AdminNavigationRouteRecord[]
  /** 导航层消费的路由元信息 */
  meta: AdminRouteMeta
  /** 当前路由的完整路径 */
  path: string
}

export interface AdminBreadcrumbItem {
  /** 面包屑项展示的图标 */
  icon?: AdminMenuIcon
  /** 面包屑项点击后跳转的路径 为空时仅展示文本 */
  path?: string
  /** 面包屑项显示标题 */
  title: string
}

export interface AdminMenuItem {
  /** 当前菜单项是否处于激活态 */
  active?: boolean
  /** 菜单项用于激活匹配的路径 */
  activePath?: string
  /** 当前菜单项要求的权限标识 */
  authority?: AdminMenuAuthority
  /** 子级菜单项 */
  children?: AdminMenuItem[]
  /** 菜单项跳转的外部链接地址 */
  externalLink?: string
  /** 菜单项展示的图标 */
  icon?: AdminMenuIcon
  /** 菜单项在导航树中的稳定标识 */
  id: string
  /** 菜单项排序权重 */
  order?: number
  /** 菜单项实际跳转路径 */
  path: string
  /** 菜单项显示标题 */
  title: string
}

export interface AdminMenuGroupMeta {
  /** 菜单分组的稳定标识 */
  id?: string
  /** 菜单分组显示标题 */
  label: string
  /** 菜单分组排序权重 */
  order?: number
}

export interface AdminMenuGroup {
  /** 当前分组下的菜单树 */
  children: AdminMenuItem[]
  /** 菜单分组的稳定标识 */
  id: string
  /** 菜单分组显示标题 */
  label?: string
  /** 菜单分组排序权重 */
  order?: number
}

export interface AdminTabItem {
  /** 当前标签页是否处于激活态 */
  active?: boolean
  /** 标签页是否允许关闭 */
  closable?: boolean
  /** 标签页展示的图标 */
  icon?: AdminMenuIcon
  /** 标签页对应的唯一路径 */
  path: string
  /** 标签页显示标题 */
  title: string
}

export type LayoutRouteMeta = AdminRouteMeta
export type LayoutMenuItem = AdminMenuItem
export type LayoutMenuGroup = AdminMenuGroup
export type LayoutBreadcrumbItem = AdminBreadcrumbItem
