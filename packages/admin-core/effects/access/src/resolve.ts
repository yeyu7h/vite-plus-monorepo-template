import type { AdminBackendMenu, AdminMenuGroup, AdminNavigationRouteRecord } from '@monorepo-admin-core/types'
import type { RouteRecordRaw } from 'vue-router'
import { buildAdminMenuGroups } from '@monorepo-admin-core/layout-effect/navigation'
import { mergeBackendMenusWithFileRoutes, type MergeBackendMenusOptions } from './merge'
import { createAdminNavigationRoutes } from './navigation'
import { type AdminForbiddenComponent, filterRoutesByAuthority } from './permission'

export interface ResolvedAdminAccess {
  accessibleRoutes: RouteRecordRaw[]
  menuGroups: AdminMenuGroup[]
  navigationRoutes: AdminNavigationRouteRecord[]
  routePathSet: Set<string>
}

export interface ResolveAdminAccessOptions extends MergeBackendMenusOptions {
  forbiddenComponent: AdminForbiddenComponent
}

export function resolveAdminAccess(
  accessFileRoutes: readonly RouteRecordRaw[],
  backendMenus: readonly AdminBackendMenu[],
  roles: readonly string[],
  options: ResolveAdminAccessOptions,
): ResolvedAdminAccess {
  const mergedRoutes = mergeBackendMenusWithFileRoutes(backendMenus, accessFileRoutes, options)
  const accessibleRoutes = filterRoutesByAuthority(mergedRoutes, roles, options.forbiddenComponent)
  const navigationRoutes = createAdminNavigationRoutes(accessibleRoutes)
  const menuGroups = buildAdminMenuGroups(navigationRoutes)

  return {
    accessibleRoutes,
    menuGroups,
    navigationRoutes,
    routePathSet: new Set(navigationRoutes.map((route) => route.path)),
  }
}
