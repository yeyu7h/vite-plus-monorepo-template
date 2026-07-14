import type { LayoutBreadcrumbItem, LayoutType } from '@monorepo-admin-core/types'

export interface LayoutProps {
  breadcrumbPrefix?: LayoutBreadcrumbItem[]

  breadcrumbs?: LayoutBreadcrumbItem[]

  /**
   * @default true
   */
  tabbarEnable?: boolean

  /**
   * @default sidebar-nav
   */
  layout?: LayoutType
}
