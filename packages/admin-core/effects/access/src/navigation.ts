import type { AdminNavigationRouteRecord, AdminRouteMeta } from '@monorepo-admin-core/types'
import type { RouteRecordRaw } from 'vue-router'
import { getAdminParentPath, normalizeAdminPath, resolveAdminRoutePath } from './path'

export function createAdminNavigationRoutes(routes: readonly RouteRecordRaw[], parentPath = ''): AdminNavigationRouteRecord[] {
  return routes.flatMap((route) => {
    const meta = (route.meta ?? {}) as AdminRouteMeta
    const path = resolveAdminRoutePath(parentPath, route.path)
    const parent = getAdminParentPath(path)
    const activePath = normalizeAdminPath(meta.activePath ?? path)
    const tabPath = normalizeAdminPath(meta.tabPath ?? path)
    const currentRoute: AdminNavigationRouteRecord = {
      activePath,
      meta,
      parentPath: parent,
      path,
      source: meta.source,
      tabPath,
    }
    const children = route.children ? createAdminNavigationRoutes(route.children, path) : []

    return [currentRoute, ...children]
  })
}
