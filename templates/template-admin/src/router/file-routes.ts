import type { RouteRecordRaw } from 'vue-router'
import { filterRawRouteRecords } from '@monorepo-admin-core/access-effect'

export function selectAccessFileRoutes(routes: readonly RouteRecordRaw[]) {
  return filterRawRouteRecords(routes, (route) => route.meta?.initial !== true && hasRouteTarget(route))
}

export function selectInitialFileRoutes(routes: readonly RouteRecordRaw[]) {
  return prepareInitialRoutes(filterRawRouteRecords(routes, (route) => route.meta?.initial === true))
}

function hasRouteTarget(route: RouteRecordRaw) {
  return ('component' in route && Boolean(route.component)) || ('components' in route && Boolean(route.components)) || Boolean(route.redirect)
}

function prepareInitialRoutes(routes: readonly RouteRecordRaw[]): RouteRecordRaw[] {
  return routes.map((route) => {
    const nextRoute = {
      ...route,
      children: route.children ? prepareInitialRoutes(route.children) : void 0,
    } as RouteRecordRaw

    if (!hasRouteTarget(nextRoute)) {
      nextRoute.meta = {
        ...nextRoute.meta,
        layout: false,
      }
    }

    return nextRoute
  })
}
