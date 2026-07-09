import type { AdminMenuAuthority, AdminMenuGroupMeta, AdminMenuIcon } from './menu'

export type AdminRouteSource = 'access' | 'core' | 'fallback'

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
  /** 声明当前路由不进入登录权限拦截 */
  ignoreAccess?: boolean
  /** 定义该路由在菜单、面包屑和标签页中显示的图标 */
  icon?: AdminMenuIcon
  /** 指定该路由所属的菜单分组，并可配置分组标题和排序 */
  menuGroup?: AdminMenuGroupMeta | string
  /** 菜单可见 但权限不命中时访问页面渲染 403 */
  menuVisibleWithForbidden?: boolean
  /** 控制菜单项或菜单分组的升序排序权重 */
  order?: number
  /** 控制激活状态下的标签页是否显示下边框 默认隐藏 */
  showActiveTabBorder?: boolean
  /** 标记路由来源分类 供权限注册流程拆分使用 */
  source?: AdminRouteSource
  /** 提供导航相关 UI 使用的显示标题 */
  title?: string
}

export interface AdminNavigationRouteRecord {
  /**
   * 当前路由用于菜单激活匹配的规范化路径
   *
   * 由导航模型生成阶段统一解析。默认等于 `path`，当 `meta.activePath`
   * 存在时使用 `meta.activePath`。菜单渲染层只消费该字段，不再自行推导
   */
  activePath?: string
  /** Vue Router 为当前路由匹配到的路由链 */
  matched?: readonly AdminNavigationRouteRecord[]
  /** 导航层消费的路由元信息 */
  meta: AdminRouteMeta
  /**
   * 当前路由的父级规范化路径
   *
   * 例如 `/system/settings/theme` 的父级路径是 `/system/settings`
   * 顶级路由没有父级时为空
   */
  parentPath?: string
  /** 当前路由的规范化完整路径 */
  path: string
  /** 当前路由来源分类 供权限注册和导航模型区分核心路由 权限路由 兜底路由 */
  source?: AdminRouteSource
  /**
   * 当前路由对应的标签页规范化路径
   *
   * 默认等于 `path`。当 `meta.hideInTab` 为 true 且存在 `meta.activePath`
   * 时使用 `meta.activePath`，表示当前页面复用父级标签页
   */
  tabPath?: string
}
