import type { AdminMenuAuthority, AdminMenuGroupMeta, AdminMenuIcon } from './menu'

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
