import type { AdminContentMode, LayoutBreadcrumbItem } from '@monorepo-admin-core/types'

export interface LayoutProps {
  breadcrumbPrefix?: LayoutBreadcrumbItem[]

  breadcrumbs?: LayoutBreadcrumbItem[]

  /**
   * @default default
   */
  contentMode?: AdminContentMode

  /**
   * @default true
   */
  tabbarEnable?: boolean
}
