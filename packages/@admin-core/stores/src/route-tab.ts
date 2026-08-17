import type { AdminNavigationRouteRecord, AdminTabItem, AdminTabRecord } from '@monorepo-admin-core/types'
import { platform } from '@monorepo/shared/utils'

/** 创建标签页时的路由解析选项 */
export interface CreateAdminTabOptions {
  /** 用于解析父级 `Tab` 对应的真实路由 */
  resolveRoute?: (path: string) => AdminNavigationRouteRecord | undefined
}

/** 关闭标签页后的结果 */
export interface CloseAdminTabResult<T extends AdminTabItem = AdminTabItem> {
  /** 关闭后应该切换到的下一个完整路由地址 */
  nextActiveTarget?: string
  /** 关闭操作后的标签页列表 */
  tabs: T[]
}

/**
 * 从当前 `route` 派生一个标签页定义
 * @param route 当前路由记录
 * @param options 用于解析父级 `Tab` 的选项
 * @returns 标签页定义，当前路由不应显示在标签栏时返回 `undefined`
 */
export function createAdminTab(route: AdminNavigationRouteRecord, options: CreateAdminTabOptions = {}): AdminTabItem | undefined {
  if (route.meta.externalLink || route.meta.hideInTab) return void 0

  const tabTarget = route.tabPath ?? route.meta.tabPath ?? route.path
  // 使用解析后的父级路由补全标签标题和图标
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
 * 从当前 `route` 派生布局运行时需要的完整标签页记录
 * @param route 当前路由记录
 * @param options 用于解析父级 `Tab` 的选项
 * @returns 完整标签页记录，当前路由不应显示在标签栏时返回 `undefined`
 */
export function createAdminTabRecord(route: AdminNavigationRouteRecord, options: CreateAdminTabOptions = {}): AdminTabRecord | undefined {
  const tab = createAdminTab(route, options)
  if (!tab) return void 0

  const iframeSrc = route.meta.iframeSrc?.trim() // 只保存非空的 `iframeSrc`，避免渲染空 iframe

  return {
    ...tab,
    ...(iframeSrc ? { iframeSrc } : {}),
    keepAlive: !platform.is.mobile && route.meta.keepAlive === true,
    meta: { ...route.meta },
    viewPath: route.path,
  }
}

/**
 * 将 `tab` 插入标签页列表，或在已存在时按 `key` 更新
 * @param tabs 当前标签页列表
 * @param tab 待插入或更新的标签页
 * @returns 更新后的标签页列表
 */
export function upsertAdminTab(tabs: readonly AdminTabItem[], tab: AdminTabItem): AdminTabItem[] {
  const existingIndex = tabs.findIndex((item) => item.key === tab.key)

  if (existingIndex === -1) return [...tabs, tab]

  return tabs.map((item, index) => (index === existingIndex ? { ...item, ...tab } : item))
}

/**
 * 为标签页列表标记当前激活项
 * @param tabs 当前标签页列表
 * @param activeKey 当前激活标签的 `key`
 * @returns 带有激活状态的标签页列表
 */
export function markActiveAdminTabs(tabs: readonly AdminTabItem[], activeKey: string): AdminTabItem[] {
  return tabs.map((tab) => ({ ...tab, active: tab.key === activeKey }))
}

/**
 * 关闭指定标签页并给出关闭后应跳转的目标标签
 * @param tabs 当前标签页列表
 * @param key 待关闭标签的 `key`
 * @param activeKey 当前激活标签的 `key`
 * @returns 关闭后的标签页列表和下一个激活目标
 */
export function closeAdminTab<T extends AdminTabItem>(tabs: readonly T[], key: string, activeKey: string): CloseAdminTabResult<T> {
  if (tabs.length <= 1) return { tabs: [...tabs] }

  const index = tabs.findIndex((tab) => tab.key === key)
  if (index === -1) return { tabs: [...tabs] }

  const nextTab = tabs[index + 1] ?? tabs[index - 1] // 关闭当前 `Tab` 时优先切右边，没有右边再退回左边
  const nextTabs = tabs.filter((tab) => tab.key !== key)

  return {
    nextActiveTarget: key === activeKey ? nextTab?.to : void 0,
    tabs: nextTabs,
  }
}
