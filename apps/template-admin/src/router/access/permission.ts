import type { AdminRouteMeta } from '@monorepo-admin-core/types'
import type { RouteRecordRaw } from 'vue-router'

export type AdminForbiddenComponent = RouteRecordRaw['component']

export function filterRoutesByAuthority(routes: readonly RouteRecordRaw[], roles: readonly string[], forbiddenComponent: AdminForbiddenComponent): RouteRecordRaw[] {
  return routes.flatMap((route) => {
    if (!hasRouteAuthority(route.meta, roles)) return []

    const children = route.children ? filterRoutesByAuthority(route.children, roles, forbiddenComponent) : void 0

    const nextRoute = { ...route } as RouteRecordRaw
    if (isMenuVisibleWithForbidden(route.meta, roles)) {
      nextRoute.component = forbiddenComponent
    }

    delete nextRoute.children
    if (children?.length) {
      nextRoute.children = children
    }

    return [nextRoute]
  })
}

function hasRouteAuthority(meta: AdminRouteMeta | undefined, roles: readonly string[]) {
  const authority = meta?.authority
  if (!authority?.length) return true

  return authority.some((role) => roles.includes(role)) || Boolean(meta?.menuVisibleWithForbidden)
}

function isMenuVisibleWithForbidden(meta: AdminRouteMeta | undefined, roles: readonly string[]) {
  const authority = meta?.authority
  if (!authority?.length || !meta?.menuVisibleWithForbidden) return false

  return !authority.some((role) => roles.includes(role))
}
