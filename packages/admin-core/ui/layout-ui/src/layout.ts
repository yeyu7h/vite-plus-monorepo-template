import type { LayoutBreadcrumbItem, LayoutType } from '@monorepo-admin-core/types'

export interface LayoutProps {
  breadcrumbPrefix?: LayoutBreadcrumbItem[]

  breadcrumbs?: LayoutBreadcrumbItem[]

  /**
   * @default true
   */
  tabbarEnable?: boolean

  /**
   * 布局方式
   * - sidebar-nav 侧边菜单
   * - header-nav 顶部菜单
   * - mixed-nav 侧边菜单 & 顶部菜单
   * - sidebar-mixed-nav 侧边双列菜单
   * - full-content 内容全屏
   * @default sidebar-nav
   */
  layout?: LayoutType
}
