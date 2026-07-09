import type { AdminNavigationRouteRecord, AdminTabItem } from '@monorepo-admin-core/types'

export interface CreateAdminTabOptions {
  /** 用于解析父级 Tab 对应的真实路由 */
  resolveRoute?: (path: string) => AdminNavigationRouteRecord | undefined
}

export interface CloseAdminTabResult {
  /** 关闭后应该切换到的下一个激活路径 */
  nextActivePath?: string
  /** 关闭操作后的标签页列表 */
  tabs: AdminTabItem[]
}

/**
 * 从当前路由派生一个标签页定义
 * @param route 当前路由
 * @param options 解析选项
 */
export function createAdminTab(route: AdminNavigationRouteRecord, options: CreateAdminTabOptions = {}): AdminTabItem | undefined {
  if (route.meta.externalLink) return undefined

  // hideInTab 表示当前页面复用父级 tab 因此标题 图标 路径都要改从 activePath 解析
  const parentTabPath = route.meta.hideInTab ? route.meta.activePath : undefined
  const resolvedRoute = typeof parentTabPath === 'string' ? options.resolveRoute?.(parentTabPath) : route
  const tabPath = typeof parentTabPath === 'string' ? parentTabPath : route.path
  const title = resolvedRoute?.meta.title ?? route.meta.title

  if (!title) return undefined

  return {
    icon: resolvedRoute?.meta.icon ?? route.meta.icon,
    path: tabPath,
    showActiveTabBorder: resolvedRoute?.meta.showActiveTabBorder ?? route.meta.showActiveTabBorder,
    title,
  }
}

/**
 * 将标签页插入列表 或在已存在时按路径更新
 * @param tabs 当前标签页列表
 * @param tab 待插入标签页
 */
export function upsertAdminTab(tabs: readonly AdminTabItem[], tab: AdminTabItem): AdminTabItem[] {
  const existingIndex = tabs.findIndex((item) => item.path === tab.path)

  if (existingIndex === -1) return [...tabs, tab]

  return tabs.map((item, index) => (index === existingIndex ? { ...item, ...tab } : item))
}

/**
 * 为标签页列表标记当前激活项
 * @param tabs 标签页列表
 * @param activePath 当前激活路径
 */
export function markActiveAdminTabs(tabs: readonly AdminTabItem[], activePath: string): AdminTabItem[] {
  return tabs.map((tab) => ({
    ...tab,
    active: tab.path === activePath,
  }))
}

/**
 * 关闭指定标签页 并给出关闭后应跳转的目标标签
 * @param tabs 当前标签页列表
 * @param path 待关闭标签路径
 * @param activePath 当前激活路径
 */
export function closeAdminTab(tabs: readonly AdminTabItem[], path: string, activePath: string): CloseAdminTabResult {
  if (tabs.length <= 1) return { tabs: [...tabs] }

  const index = tabs.findIndex((tab) => tab.path === path)
  if (index === -1) return { tabs: [...tabs] }

  // 关闭当前 tab 时 优先切右边 没有右边再退回左边
  const nextTab = tabs[index + 1] ?? tabs[index - 1]
  const nextTabs = tabs.filter((tab) => tab.path !== path)

  return {
    nextActivePath: path === activePath ? nextTab?.path : undefined,
    tabs: nextTabs,
  }
}
