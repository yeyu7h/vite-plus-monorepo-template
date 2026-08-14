import type { AdminMenuIcon } from './menu'
import type { AdminRouteMeta } from './route'

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

/**
 * 布局运行时使用的完整标签页记录
 *
 * `to` 是点击标签时使用的规范化目标，`viewPath` 则记录该标签最后实际
 * 展示的路由。两者分离后，配置了 `tabPath` 的嵌套路由也能恢复正确内容。
 */
export interface AdminTabRecord extends AdminTabItem {
  /** iframe 页面地址，普通页面为空 */
  iframeSrc?: string
  /** 当前标签页是否保留运行状态 */
  keepAlive: boolean
  /** 最后一次访问时的路由元信息 */
  meta: AdminRouteMeta
  /** 当前标签页最后实际展示的完整路由地址 */
  viewPath: string
}

/** sessionStorage 中保存的最小标签页快照 */
export interface PersistedAdminTab {
  /** 点击标签时使用的规范化目标 */
  to: string
  /** 最后实际展示的完整路由地址 */
  viewPath: string
}
