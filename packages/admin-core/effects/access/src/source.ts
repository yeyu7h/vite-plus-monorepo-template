import type { AdminRouteMeta } from '@monorepo-admin-core/types'
import type { RouteRecordRaw } from 'vue-router'
import { flattenRawRouteRecords, normalizeAdminPath } from './path'

export interface SplitAdminFileRoutesResult {
  accessFileRoutes: RouteRecordRaw[]
  coreRoutes: RouteRecordRaw[]
  fallbackRoutes: RouteRecordRaw[]
}

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
