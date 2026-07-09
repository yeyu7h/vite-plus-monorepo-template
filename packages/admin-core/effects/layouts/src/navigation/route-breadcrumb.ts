import type { AdminBreadcrumbItem, AdminNavigationRouteRecord, AdminRouteMeta } from '@monorepo-admin-core/types'
import { createAdminNavigationItemPath, formatAdminNavigationTitle, normalizeAdminNavigationPath } from './shared'

export type AdminCurrentRouteRecord = AdminNavigationRouteRecord

/**
 * 从当前路由和完整路由表生成面包屑列表
 * @param route 当前路由
 * @param routes 完整路由表
 */
export function buildAdminBreadcrumbs(route: AdminCurrentRouteRecord, routes: readonly AdminNavigationRouteRecord[] = []): AdminBreadcrumbItem[] {
  const currentPath = normalizeAdminNavigationPath(route.path)
  if (currentPath === '/') {
    if (!route.meta.title || route.meta.hideInBreadcrumb) return []
    return [createBreadcrumbItem(route.meta, route.meta.title, void 0)]
  }

  const routeByPath = createRouteByPath(routes)
  const matchedByPath = createRouteByPath(route.matched ?? [])
  const segments = currentPath.split('/').filter(Boolean)

  return segments.flatMap((segment, index) => {
    const path = `/${segments.slice(0, index + 1).join('/')}`
    const resolvedRoute = resolveBreadcrumbRoute(path, currentPath, route, matchedByPath, routeByPath)
    const meta = resolvedRoute?.meta

    if (meta?.hideInBreadcrumb) return []

    const hasExplicitTitle = Boolean(meta?.title)

    // layout 插件可能生成同路径的占位父级 路由存在但没有导航 meta 时不要把它当成真实层级
    if (path !== currentPath && !hasExplicitTitle && route.meta.menuGroup) return []

    const title = path === currentPath ? (route.meta.title ?? meta?.title ?? formatAdminNavigationTitle(segment)) : (meta?.title ?? formatAdminNavigationTitle(segment))

    if (!title) return []

    return [createBreadcrumbItem(meta, title, createBreadcrumbPath(path, currentPath, resolvedRoute, hasExplicitTitle))]
  })
}

/**
 * 从 `menuGroup` 生成位于面包屑最前面的分组前缀
 * @param route 当前路由
 */
export function buildAdminBreadcrumbPrefix(route: AdminCurrentRouteRecord): AdminBreadcrumbItem[] {
  const menuGroup = route.meta.menuGroup
  const title = typeof menuGroup === 'string' ? menuGroup : menuGroup?.label

  if (!title) return []

  return [{ title }]
}

/**
 * 建立按路径查询路由的索引 供 fallback 逻辑复用
 * @param routes 路由列表
 */
function createRouteByPath(routes: readonly AdminNavigationRouteRecord[]) {
  const routeByPath = new Map<string, AdminNavigationRouteRecord>()

  for (const route of routes) {
    const normalizedPath = normalizeAdminNavigationPath(route.path)
    if (!routeByPath.has(normalizedPath)) routeByPath.set(normalizedPath, route)
  }

  return routeByPath
}

/**
 * 为当前 breadcrumb 层级挑选最可信的路由记录
 * @param path 当前层级路径
 * @param currentPath 当前规范化路径
 * @param route 当前路由
 * @param matchedByPath `route.matched` 索引
 * @param routeByPath 完整路由索引
 */
function resolveBreadcrumbRoute(
  path: string,
  currentPath: string,
  route: AdminCurrentRouteRecord,
  matchedByPath: Map<string, AdminNavigationRouteRecord>,
  routeByPath: Map<string, AdminNavigationRouteRecord>,
) {
  if (path === currentPath) {
    return routeByPath.get(path) ?? route
  }

  return routeByPath.get(path) ?? matchedByPath.get(path)
}

/**
 * 当前模型下父级 breadcrumb 只展示层级 不提供空容器跳转
 * @param path 当前层级路径
 * @param currentPath 当前规范化路径
 * @param route 当前层级路由
 * @param hasExplicitTitle 是否具备显式标题
 */
function createBreadcrumbPath(path: string, currentPath: string, route: AdminNavigationRouteRecord | undefined, hasExplicitTitle: boolean) {
  if (!route || !hasExplicitTitle) return void 0
  if (path !== currentPath) return void 0

  return createAdminNavigationItemPath(path, route.meta, currentPath)
}

/**
 * 在同一路径出现多条 route record 时 优先保留更像真实导航节点的记录
 * @param left 路由记录
 * @param right 路由记录
 */
function createBreadcrumbItem(meta: AdminRouteMeta | undefined, title: string, path: string | undefined): AdminBreadcrumbItem {
  return {
    icon: meta?.icon,
    path,
    title,
  }
}
