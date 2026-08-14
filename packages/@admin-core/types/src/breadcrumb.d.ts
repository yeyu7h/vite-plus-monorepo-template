import type { AdminMenuIcon } from './menu'

export interface AdminBreadcrumbItem {
  /** 面包屑项展示的图标 */
  icon?: AdminMenuIcon
  /** 面包屑项点击后跳转的路径 为空时仅展示文本 */
  path?: string
  /** 面包屑项显示标题 */
  title: string
}
