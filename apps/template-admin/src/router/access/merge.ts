import type { AdminBackendMenu, AdminRouteMeta } from '@monorepo-admin-core/types'
import type { RouteRecordRaw } from 'vue-router'
import { flattenRawRouteRecords, normalizeAdminPath } from './path'

export function mergeBackendMenusWithFileRoutes(backendMenus: readonly AdminBackendMenu[], accessFileRoutes: readonly RouteRecordRaw[]): RouteRecordRaw[] {
  const fileRouteMap = createRouteMap(accessFileRoutes)

  return backendMenus.flatMap((menu) => {
    const route = mergeBackendMenuWithFileRoute(menu, fileRouteMap)
    return route ? [route] : []
  })
}

function mergeBackendMenuWithFileRoute(menu: AdminBackendMenu, fileRouteMap: Map<string, RouteRecordRaw>, inheritedMenuGroup?: AdminRouteMeta['menuGroup']): RouteRecordRaw | undefined {
  const normalizedPath = normalizeAdminPath(menu.path)
  const fileRoute = fileRouteMap.get(normalizedPath)

  if (!fileRoute) {
    return void 0
  }

  const menuGroup = menu.meta.menuGroup ?? inheritedMenuGroup
  const children = menu.children?.flatMap((child) => {
    const route = mergeBackendMenuWithFileRoute(child, fileRouteMap, menuGroup)
    return route ? [route] : []
  })

  const nextRoute = {
    ...fileRoute,
    meta: {
      ...fileRoute.meta,
      ...menu.meta,
      menuGroup,
      source: 'access',
    },
    path: fileRoute.path,
  } as RouteRecordRaw
  delete nextRoute.children

  if (children?.length) {
    nextRoute.children = children
  }

  return nextRoute
}

function createRouteMap(routes: readonly RouteRecordRaw[]) {
  const routeMap = new Map<string, RouteRecordRaw>()

  for (const route of routes) {
    for (const flattenedRoute of flattenRawRouteRecords([route])) {
      routeMap.set(normalizeAdminPath(flattenedRoute.path), flattenedRoute)
    }
  }

  return routeMap
}
