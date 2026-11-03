import type { AdminRouteMeta } from '@monorepo-admin-core/types'
import type { RouteRecordRaw } from 'vue-router'
import { hasAdminRouteTarget } from './path'

export type AdminForbiddenComponent = RouteRecordRaw['component']

export function filterRoutesByAuthority(routes: readonly RouteRecordRaw[], roles: readonly string[], forbiddenComponent: AdminForbiddenComponent): RouteRecordRaw[] {
  return routes.flatMap((route) => {
    const meta = route.meta as AdminRouteMeta | undefined
    const allowed = !meta?.authority?.length || meta.authority.some((role) => roles.includes(role))
    if (!allowed && !meta?.menuVisibleWithForbidden) return []

    const children = route.children ? filterRoutesByAuthority(route.children, roles, forbiddenComponent) : undefined
    // Remove directory-only routes when all children are removed; 403 entries still have a page / 子路由全部移除后也移除纯目录路由；403 入口仍有实际页面
    if (meta?.menuType === 'directory' && !hasAdminRouteTarget(route) && !children?.length && allowed) return []

    const nextRoute = { ...route } as RouteRecordRaw
    if (!allowed) {
      nextRoute.component = forbiddenComponent
      nextRoute.meta = { ...meta, menuType: 'menu' }
    }

    delete nextRoute.children
    if (children?.length) nextRoute.children = children
    return [nextRoute]
  })
}
