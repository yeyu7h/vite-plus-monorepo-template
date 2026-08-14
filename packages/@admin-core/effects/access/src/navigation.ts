import type { AdminNavigationRouteRecord, AdminRouteMeta } from '@monorepo-admin-core/types'
import type { RouteRecordRaw } from 'vue-router'
import { normalizeAdminPath, resolveAdminRoutePath } from './path'

export function createAdminNavigationRoutes(routes: readonly RouteRecordRaw[], parentPath = ''): AdminNavigationRouteRecord[] {
  return routes.flatMap((route) => {
    const meta = (route.meta ?? {}) as AdminRouteMeta
    const path = resolveAdminRoutePath(parentPath, route.path)
    const activePath = normalizeAdminPath(meta.activePath ?? path)
    const tabPath = normalizeAdminPath(meta.tabPath ?? path)
    const currentRoute: AdminNavigationRouteRecord = {
      activePath,
      meta,
      // 菜单层级只来自路由树（即后端菜单 children），不能从 URL 片段反推。
      parentPath: parentPath ? normalizeAdminPath(parentPath) : void 0,
      path,
      source: meta.source,
      tabPath,
    }
    const children = route.children ? createAdminNavigationRoutes(route.children, path) : []

    return [currentRoute, ...children]
  })
}
