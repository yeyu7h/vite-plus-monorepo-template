import type { AdminNavigationRouteRecord, AdminTabItem } from '@monorepo-admin-core/types'

export interface CreateAdminTabOptions {
  /** 用于解析父级 Tab 对应的真实路由 */
  resolveRoute?: (path: string) => AdminNavigationRouteRecord | undefined
}

export interface CloseAdminTabResult {
  /** 关闭后应该切换到的下一个完整路由地址 */
  nextActiveTarget?: string
  /** 关闭操作后的标签页列表 */
  tabs: AdminTabItem[]
}

/**
 * 从当前路由派生一个标签页定义
 * @param route 当前路由
 * @param options 解析选项
 */
export function createAdminTab(route: AdminNavigationRouteRecord, options: CreateAdminTabOptions = {}): AdminTabItem | undefined {
  if (route.meta.externalLink || route.meta.hideInTab) return void 0

  const tabTarget = route.tabPath ?? route.meta.tabPath ?? route.path
  const resolvedRoute = tabTarget !== route.path ? (options.resolveRoute?.(tabTarget) ?? route) : route
  const title = resolvedRoute?.meta.title ?? route.meta.title

  if (!title) return void 0

  return {
    icon: resolvedRoute?.meta.icon ?? route.meta.icon,
    key: tabTarget,
    showActiveTabBorder: resolvedRoute?.meta.showActiveTabBorder ?? route.meta.showActiveTabBorder,
    title,
    to: tabTarget,
  }
}

/**
 * 将标签页插入列表 或在已存在时按路径更新
 * @param tabs 当前标签页列表
 * @param tab 待插入标签页
 */
export function upsertAdminTab(tabs: readonly AdminTabItem[], tab: AdminTabItem): AdminTabItem[] {
  const existingIndex = tabs.findIndex((item) => item.key === tab.key)

  if (existingIndex === -1) return [...tabs, tab]

  return tabs.map((item, index) => (index === existingIndex ? { ...item, ...tab } : item))
}

/**
 * 为标签页列表标记当前激活项
 * @param tabs 标签页列表
 * @param activeKey 当前激活标签标识
 */
export function markActiveAdminTabs(tabs: readonly AdminTabItem[], activeKey: string): AdminTabItem[] {
  return tabs.map((tab) => ({
    ...tab,
    active: tab.key === activeKey,
  }))
}

/**
 * 关闭指定标签页 并给出关闭后应跳转的目标标签
 * @param tabs 当前标签页列表
 * @param key 待关闭标签标识
 * @param activeKey 当前激活标签标识
 */
export function closeAdminTab(tabs: readonly AdminTabItem[], key: string, activeKey: string): CloseAdminTabResult {
  if (tabs.length <= 1) return { tabs: [...tabs] }

  const index = tabs.findIndex((tab) => tab.key === key)
  if (index === -1) return { tabs: [...tabs] }

  // 关闭当前 tab 时 优先切右边 没有右边再退回左边
  const nextTab = tabs[index + 1] ?? tabs[index - 1]
  const nextTabs = tabs.filter((tab) => tab.key !== key)

  return {
    nextActiveTarget: key === activeKey ? nextTab?.to : void 0,
    tabs: nextTabs,
  }
}
