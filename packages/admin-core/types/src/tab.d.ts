import type { AdminMenuIcon } from './menu'

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
