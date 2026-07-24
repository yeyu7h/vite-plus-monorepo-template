import type { AdminBackendMenu, AdminRouteMeta } from '@monorepo-admin-core/types'
import type { RouteRecordRaw } from 'vue-router'
import { resolveAdminRoutePath } from './path'

export function mergeBackendMenusWithFileRoutes(backendMenus: readonly AdminBackendMenu[], accessFileRoutes: readonly RouteRecordRaw[]): RouteRecordRaw[] {
  const fileRouteMap = createRouteMap(accessFileRoutes)

  return backendMenus.flatMap((menu) => {
    const route = mergeBackendMenuWithFileRoute(menu, fileRouteMap)
    return route ? [route] : []
  })
}

function mergeBackendMenuWithFileRoute(
  menu: AdminBackendMenu,
  fileRouteMap: Map<string, RouteRecordRaw>,
  parentPath = '',
  inheritedMenuGroup?: AdminRouteMeta['menuGroup'],
): RouteRecordRaw | undefined {
  const fullPath = resolveAdminRoutePath(parentPath, menu.path)
  const fileRoute = fileRouteMap.get(fullPath)

  if (!fileRoute) {
    return void 0
  }

  const menuGroup = menu.meta.menuGroup ?? inheritedMenuGroup
  const children = menu.children?.flatMap((child) => {
    const route = mergeBackendMenuWithFileRoute(child, fileRouteMap, fullPath, menuGroup)
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
    path: resolveMergedRoutePath(parentPath, fullPath),
  } as RouteRecordRaw
  delete nextRoute.children

  if (children?.length) {
    nextRoute.children = children
  }

  return nextRoute
}

function createRouteMap(routes: readonly RouteRecordRaw[], parentPath = '', routeMap = new Map<string, RouteRecordRaw>()) {
  for (const route of routes) {
    const fullPath = resolveAdminRoutePath(parentPath, route.path)
    const candidate = { ...route } as RouteRecordRaw
    delete candidate.children

    routeMap.set(fullPath, candidate)

    if (route.children) {
      createRouteMap(route.children, fullPath, routeMap)
    }
  }

  return routeMap
}

function resolveMergedRoutePath(parentPath: string, fullPath: string) {
  if (!parentPath) return fullPath
  if (fullPath === parentPath) return ''

  const parentPrefix = parentPath === '/' ? '/' : `${parentPath}/`
  return fullPath.startsWith(parentPrefix) ? fullPath.slice(parentPrefix.length) : fullPath
}
