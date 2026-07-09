import type { AdminBackendMenu, AdminMenuGroup, AdminNavigationRouteRecord } from '@monorepo-admin-core/types'
import type { RouteRecordRaw } from 'vue-router'
import { buildAdminMenuGroups } from '@monorepo-admin-core/layout-effect/navigation'
import { createAdminNavigationRoutes } from './navigation'
import { filterRoutesByAuthority } from './permission'
import { mergeBackendMenusWithFileRoutes } from './merge'

export type { SplitAdminFileRoutesResult } from './source'
export { normalizeAdminPath } from './path'
export { registerAdminAccessRoutes, resetAdminAccessRoutes } from './register'
export { splitAdminFileRoutes } from './source'

export interface ResolvedAdminAccess {
  accessibleRoutes: RouteRecordRaw[]
  menuGroups: AdminMenuGroup[]
  navigationRoutes: AdminNavigationRouteRecord[]
  routePathSet: Set<string>
}

const forbiddenComponent = () => import('@/pages/403.vue')

export function resolveAdminAccess(accessFileRoutes: readonly RouteRecordRaw[], backendMenus: readonly AdminBackendMenu[], roles: readonly string[]): ResolvedAdminAccess {
  const mergedRoutes = mergeBackendMenusWithFileRoutes(backendMenus, accessFileRoutes)
  const accessibleRoutes = filterRoutesByAuthority(mergedRoutes, roles, forbiddenComponent)
  const navigationRoutes = createAdminNavigationRoutes(accessibleRoutes)
  const menuGroups = buildAdminMenuGroups(navigationRoutes)

  return {
    accessibleRoutes,
    menuGroups,
    navigationRoutes,
    routePathSet: new Set(navigationRoutes.map((route) => route.path)),
  }
}
