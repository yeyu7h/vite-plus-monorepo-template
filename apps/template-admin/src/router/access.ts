import type { AdminBackendMenu, AdminMenuGroup, AdminNavigationRouteRecord, AdminRouteMeta } from '@monorepo-admin-core/types'
import type { RouteRecordRaw, Router } from 'vue-router'
import { buildAdminMenuGroups } from '@monorepo-admin-core/layout-effect/navigation'
import { setupLayouts } from 'virtual:generated-layouts'

export interface SplitAdminFileRoutesResult {
  accessFileRoutes: RouteRecordRaw[]
  coreRoutes: RouteRecordRaw[]
  fallbackRoutes: RouteRecordRaw[]
}

export interface ResolvedAdminAccess {
  accessibleRoutes: RouteRecordRaw[]
  menuGroups: AdminMenuGroup[]
  navigationRoutes: AdminNavigationRouteRecord[]
  routePathSet: Set<string>
}

const dynamicRouteRemovers: Array<() => void> = []
const forbiddenComponent = () => import('@/pages/403.vue')

export function splitAdminFileRoutes(routes: readonly RouteRecordRaw[]): SplitAdminFileRoutesResult {
  const accessFileRoutes: RouteRecordRaw[] = []
  const coreRoutes: RouteRecordRaw[] = []
  const fallbackRoutes: RouteRecordRaw[] = []

  for (const route of flattenRawRouteRecords(routes).map(createRouteCandidate)) {
    if (isCoreRoute(route)) {
      coreRoutes.push(withRouteSource(route, 'core'))
    } else if (isFallbackRoute(route)) {
      fallbackRoutes.push(withRouteSource(route, 'fallback'))
    } else {
      accessFileRoutes.push(withRouteSource(route, 'access'))
    }
  }

  return {
    accessFileRoutes,
    coreRoutes,
    fallbackRoutes,
  }
}

export function resolveAdminAccess(accessFileRoutes: readonly RouteRecordRaw[], backendMenus: readonly AdminBackendMenu[], roles: readonly string[]): ResolvedAdminAccess {
  const fileRouteMap = createRouteMap(accessFileRoutes)
  const mergedRoutes = mergeBackendMenusWithFileRoutes(backendMenus, fileRouteMap)
  const accessibleRoutes = filterRoutesByAuthority(mergedRoutes, roles)
  const navigationRoutes = flattenRouteRecords(accessibleRoutes)
  const menuGroups = buildAdminMenuGroups(navigationRoutes)

  return {
    accessibleRoutes,
    menuGroups,
    navigationRoutes,
    routePathSet: new Set(navigationRoutes.map((route) => normalizeAdminPath(route.path))),
  }
}

export function registerAdminAccessRoutes(router: Router, routes: readonly RouteRecordRaw[]) {
  resetAdminAccessRoutes()

  for (const route of setupLayouts([...routes])) {
    dynamicRouteRemovers.push(router.addRoute(route))
  }
}

export function resetAdminAccessRoutes() {
  while (dynamicRouteRemovers.length) {
    dynamicRouteRemovers.pop()?.()
  }
}

export function normalizeAdminPath(path: string) {
  if (!path) return '/'
  const normalized = path.replace(/\/+/g, '/')
  if (normalized === '/') return normalized
  return normalized.replace(/\/$/, '')
}

function mergeBackendMenusWithFileRoutes(backendMenus: readonly AdminBackendMenu[], fileRouteMap: Map<string, RouteRecordRaw>): RouteRecordRaw[] {
  return backendMenus.flatMap((menu) => {
    const route = mergeBackendMenuWithFileRoute(menu, fileRouteMap)
    return route ? [route] : []
  })
}

function mergeBackendMenuWithFileRoute(menu: AdminBackendMenu, fileRouteMap: Map<string, RouteRecordRaw>, inheritedMenuGroup?: AdminRouteMeta['menuGroup']): RouteRecordRaw | undefined {
  const normalizedPath = normalizeAdminPath(menu.path)
  const fileRoute = fileRouteMap.get(normalizedPath)

  if (!fileRoute) {
    return undefined
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

function filterRoutesByAuthority(routes: readonly RouteRecordRaw[], roles: readonly string[]): RouteRecordRaw[] {
  return routes.flatMap((route) => {
    if (!hasRouteAuthority(route.meta, roles)) return []

    const children = route.children ? filterRoutesByAuthority(route.children, roles) : undefined

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

function createRouteMap(routes: readonly RouteRecordRaw[]) {
  const routeMap = new Map<string, RouteRecordRaw>()

  for (const route of routes) {
    for (const flattenedRoute of flattenRawRouteRecords([route])) {
      routeMap.set(normalizeAdminPath(flattenedRoute.path), flattenedRoute)
    }
  }

  return routeMap
}

function flattenRawRouteRecords(routes: readonly RouteRecordRaw[], parentPath = ''): RouteRecordRaw[] {
  return routes.flatMap((route) => {
    const path = resolveRoutePath(parentPath, route.path)
    const currentRoute = {
      ...route,
      path,
    } as RouteRecordRaw
    const children = route.children ? flattenRawRouteRecords(route.children, path) : []

    return [currentRoute, ...children]
  })
}

function flattenRouteRecords(routes: readonly RouteRecordRaw[], parentPath = ''): AdminNavigationRouteRecord[] {
  return routes.flatMap((route) => {
    const path = resolveRoutePath(parentPath, route.path)
    const currentRoute: AdminNavigationRouteRecord = {
      matched: undefined,
      meta: route.meta ?? {},
      path,
    }
    const children = route.children ? flattenRouteRecords(route.children, path) : []

    return [currentRoute, ...children]
  })
}

function resolveRoutePath(parentPath: string, path: string) {
  if (path.startsWith('/')) return normalizeAdminPath(path)
  if (!parentPath) return normalizeAdminPath(`/${path}`)

  return normalizeAdminPath(`${parentPath}/${path}`)
}

function withRouteSource(route: RouteRecordRaw, source: AdminRouteMeta['source']): RouteRecordRaw {
  const nextRoute = {
    ...route,
    meta: {
      ...route.meta,
      source,
    },
  } as RouteRecordRaw
  delete nextRoute.children

  if (route.children?.length) {
    nextRoute.children = route.children.map((child) => withRouteSource(child, source))
  }

  return nextRoute
}

function createRouteCandidate(route: RouteRecordRaw): RouteRecordRaw {
  const candidate = { ...route } as RouteRecordRaw
  delete candidate.children

  return candidate
}

function isCoreRoute(route: RouteRecordRaw) {
  return normalizeAdminPath(route.path).startsWith('/auth') || route.meta?.source === 'core'
}

function isFallbackRoute(route: RouteRecordRaw) {
  const path = normalizeAdminPath(route.path)

  return route.meta?.source === 'fallback' || path === '/403' || path === '/404' || path.includes(':pathMatch') || path.includes('(.*)') || path.includes('...')
}
