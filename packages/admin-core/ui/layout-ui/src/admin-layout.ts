import type { LayoutType } from '@monorepo-admin-core/types'

export interface AdminLayoutProps {
  /**
   * @default true
   */
  tabbarEnable?: boolean

  /**
   * 布局方式
   * - sidebar-nav 侧边菜单布局
   * - header-nav 顶部菜单布局
   * - mixed-nav 侧边&顶部菜单布局
   * - sidebar-mixed-nav 侧边混合菜单布局
   * - full-content 全屏内容布局
   * @default sidebar-nav
   */
  layout?: LayoutType
}
