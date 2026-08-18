/** Supported fallback states. 支持的回退状态 */
export type FallbackStatus = '403' | '404' | '500' | 'coming-soon' | 'offline'

/** Props for the fallback component. 回退页组件属性 */
export interface FallbackProps {
  /** State to render, defaulting to coming soon. 要渲染的状态，默认为敬请期待 */
  status?: FallbackStatus
  /** Overrides the title for the selected state. 覆盖当前状态的标题 */
  title?: string
  /** Overrides the description for the selected state. 覆盖当前状态的描述 */
  description?: string
  /** Route used by the built-in home action. 返回首页操作使用的路由地址 */
  homePath?: string
  /** Image URL that replaces the built-in visual. 替换默认视觉的图片地址 */
  image?: string
  /** Whether to render the action area. 是否显示操作区域 */
  showAction?: boolean
}
