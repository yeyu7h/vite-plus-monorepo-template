import type { AdminGroupMeta, AdminMenuGroup, AdminMenuItem, AdminNavigationRouteNode, AdminRouteMeta } from '@monorepo-admin-core/types'
import { normalizeAdminNavigationPath } from './shared'

export interface BuildAdminMenusOptions {
  /** 菜单深度限制在 1–3 级，超出的节点提升到最深一级 */
  maxDepth?: number
}

export interface BuildAdminMenuGroupsOptions extends BuildAdminMenusOptions {
  defaultGroup?: AdminGroupMeta
}

interface MenuParent {
  groupId: string
  depth: number
  children: AdminMenuItem[]
  siblings: AdminMenuItem[]
}

const MAX_MENU_DEPTH = 3
const DEFAULT_MENU_GROUP_ID = 'default'

/** 从规范化导航树生成菜单，不改变路由树及其可访问性。 */
export function buildAdminMenus(routes: readonly AdminNavigationRouteNode[], options: BuildAdminMenusOptions = {}): AdminMenuItem[] {
  return buildMenuGroups(routes, options, false)[0]?.children ?? []
}

export function buildAdminMenuGroups(routes: readonly AdminNavigationRouteNode[], options: BuildAdminMenuGroupsOptions = {}): AdminMenuGroup[] {
  return buildMenuGroups(routes, options, true)
}

function buildMenuGroups(routes: readonly AdminNavigationRouteNode[], options: BuildAdminMenuGroupsOptions, grouped: boolean): AdminMenuGroup[] {
  const maxDepth = Math.max(1, Math.min(Math.floor(options.maxDepth ?? MAX_MENU_DEPTH), MAX_MENU_DEPTH))
  const groups = new Map<string, AdminMenuGroup>()

  function visit(route: AdminNavigationRouteNode, parent?: MenuParent) {
    if (!isMenuRoute(route)) {
      // Hide only the current menu node; visible descendants remain displayed and the route tree is unchanged / 只隐藏当前菜单节点；可见后代仍独立展示，路由树保持原样
      route.children?.forEach((child) => visit(child))
      return
    }

    const meta = resolveMenuGroupMeta(grouped ? route.meta.group : undefined, options.defaultGroup)
    let group = groups.get(meta.id)
    if (!group) {
      group = { ...meta, children: [] }
      groups.set(meta.id, group)
    }

    // A child that explicitly changes groups becomes the root menu of the new group / 子节点显式切换分组时成为新分组的根菜单
    const sameParent = parent?.groupId === group.id ? parent : undefined
    const originalDepth = sameParent ? sameParent.depth + 1 : 1
    const promoted = originalDepth > maxDepth
    const depth = Math.min(originalDepth, maxDepth)
    const siblings = sameParent ? (promoted ? sameParent.siblings : sameParent.children) : group.children
    const children: AdminMenuItem[] = []

    route.children?.forEach((child) => visit(child, { groupId: group.id, depth, children, siblings }))

    if (!route.navigable && children.length === 0) return // A directory has no page target and must not become a link after filtering its children / 纯目录没有页面目标，不能在过滤子项后退化为链接

    if (promoted) {
      console.warn(`[admin-menu] 路由 "${route.path}" 超过 ${maxDepth} 级菜单限制，已自动提升为第 ${maxDepth} 级菜单项；如无需展示，请设置 meta.hideInMenu`)
    }

    children.sort(compareMenuItems)
    siblings.push({
      activePath: route.path,
      authority: route.meta.authority,
      children: children.length ? children : undefined,
      externalLink: route.meta.externalLink,
      icon: route.meta.icon,
      id: route.id,
      order: route.meta.order ?? (children.length ? Math.min(...children.map((child) => child.order ?? 0)) : 0),
      path: route.meta.externalLink ?? route.path,
      title: route.meta.title!,
    })
  }

  routes.forEach((route) => visit(route))
  const defaultGroupId = options.defaultGroup?.id ?? DEFAULT_MENU_GROUP_ID
  return [...groups.values()]
    .filter((group) => group.children.length > 0)
    .map((group) => ({ ...group, children: group.children.sort(compareMenuItems) }))
    .sort((a, b) => {
      if (a.id === defaultGroupId) return b.id === defaultGroupId ? 0 : 1
      if (b.id === defaultGroupId) return -1
      return (a.order ?? 0) - (b.order ?? 0) || (a.label ?? '').localeCompare(b.label ?? '') || a.id.localeCompare(b.id)
    })
}

/** 精确匹配当前菜单，再沿真实父子关系向上标记，详情页由当前路由的 `activePath` 指定目标 */
export function markActiveAdminMenus(items: readonly AdminMenuItem[], activePath: string): AdminMenuItem[] {
  const path = normalizeAdminNavigationPath(activePath)
  function mark(nodes: readonly AdminMenuItem[]): AdminMenuItem[] {
    return nodes.map((item) => {
      const children = item.children ? mark(item.children) : undefined
      return {
        ...item,
        active: normalizeAdminNavigationPath(item.activePath ?? item.path) === path || Boolean(children?.some((child) => child.active)),
        children,
      }
    })
  }
  return mark(items)
}

export function markActiveAdminMenuGroups(groups: readonly AdminMenuGroup[], activePath: string): AdminMenuGroup[] {
  return groups.map((group) => ({ ...group, children: markActiveAdminMenus(group.children, activePath) }))
}

function compareMenuItems(a: AdminMenuItem, b: AdminMenuItem) {
  // Keep sorting equal-weight, equal-title routes by path; backend IDs identify nodes only / 保持同权重、同标题时按路由路径排序，后端 ID 只用于节点身份
  return (a.order ?? 0) - (b.order ?? 0) || a.title.localeCompare(b.title) || (a.activePath ?? a.path).localeCompare(b.activePath ?? b.path) || a.id.localeCompare(b.id)
}

function resolveMenuGroupMeta(group: AdminRouteMeta['group'], defaultGroup?: AdminGroupMeta): Omit<AdminMenuGroup, 'children'> {
  if (typeof group === 'string') return { id: `group:${group}`, label: group }
  if (group) return { id: group.id ?? `group:${group.label}`, label: group.label, order: group.order }
  return { id: defaultGroup?.id ?? DEFAULT_MENU_GROUP_ID, label: defaultGroup?.label, order: defaultGroup?.order }
}

function isMenuRoute(route: AdminNavigationRouteNode) {
  return Boolean(route.meta.title && !route.meta.hideInMenu && route.path !== '/' && !/[:*(]/.test(route.path))
}
