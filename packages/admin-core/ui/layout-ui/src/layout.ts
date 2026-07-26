import type { AdminContentMode, AdminScrollMode, LayoutBreadcrumbItem, LayoutType } from '@monorepo-admin-core/types'

const DEFAULT_CONTENT_BODY_CLASS = 'relative'
const DOCUMENT_CONTENT_BODY_CLASS = 'relative overflow-y-visible'
const DOCUMENT_GROUP_CLASS = 'static inset-auto min-h-svh overflow-visible'
const DOCUMENT_SIDEBAR_CLASS = 'lg:fixed lg:inset-y-0 lg:start-0 lg:z-30 lg:h-svh'
const FULL_CONTENT_BODY_CLASS = 'relative min-h-0 gap-0 overflow-hidden p-0 sm:gap-0 sm:p-0'

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

  /**
   * @default sidebar-nav
   */
  layout?: LayoutType

  /**
   * 普通页面的全局滚动容器 full 页面始终使用固定视口布局
   * @default panel
   */
  scrollMode?: AdminScrollMode

  /**
   * 仅在 document 滚动模式下生效
   * @default false
   */
  stickyHeader?: boolean
}

export function isDocumentScrollLayout(contentMode: AdminContentMode = 'default', scrollMode: AdminScrollMode = 'panel') {
  return contentMode !== 'full' && scrollMode === 'document'
}

export function resolveLayoutContentBodyClass(contentMode: AdminContentMode = 'default', scrollMode: AdminScrollMode = 'panel') {
  if (contentMode === 'full') return FULL_CONTENT_BODY_CLASS
  return isDocumentScrollLayout(contentMode, scrollMode) ? DOCUMENT_CONTENT_BODY_CLASS : DEFAULT_CONTENT_BODY_CLASS
}

export function resolveLayoutGroupClass(contentMode: AdminContentMode = 'default', scrollMode: AdminScrollMode = 'panel') {
  return isDocumentScrollLayout(contentMode, scrollMode) ? DOCUMENT_GROUP_CLASS : undefined
}

export function resolveLayoutHeaderClass(contentMode: AdminContentMode = 'default', scrollMode: AdminScrollMode = 'panel', stickyHeader = false) {
  return isDocumentScrollLayout(contentMode, scrollMode) && stickyHeader ? 'sticky top-0 z-20 shrink-0 bg-default' : 'shrink-0'
}

export function resolveLayoutSidebarClass(contentMode: AdminContentMode = 'default', scrollMode: AdminScrollMode = 'panel') {
  return isDocumentScrollLayout(contentMode, scrollMode) ? DOCUMENT_SIDEBAR_CLASS : undefined
}
