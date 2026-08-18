import type { LayoutBreadcrumbItem } from '@monorepo-admin-core/types'

export interface LayoutProps {
  breadcrumbPrefix?: LayoutBreadcrumbItem[]

  breadcrumbs?: LayoutBreadcrumbItem[]

  /**
   * @default true
   */
  tabbarEnable?: boolean
}
