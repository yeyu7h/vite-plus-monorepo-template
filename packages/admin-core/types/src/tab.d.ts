import type { AdminMenuIcon } from './menu'

export interface AdminTabItem {
  /** 当前标签页是否处于激活态 */
  active?: boolean
  /** 标签页是否允许关闭 */
  closable?: boolean
  /** 标签页展示的图标 */
  icon?: AdminMenuIcon
  /** 标签页唯一标识，默认使用包含 query 和 hash 的完整路由地址 */
  key: string
  /** 激活状态下是否显示标签页下边框 */
  showActiveTabBorder?: boolean
  /** 标签页显示标题 */
  title: string
  /** 点击标签页时恢复的完整路由地址 */
  to: string
}
