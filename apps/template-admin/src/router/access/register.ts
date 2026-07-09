import type { RouteRecordRaw, Router } from 'vue-router'
import { setupLayouts } from 'virtual:generated-layouts'

const dynamicRouteRemovers: Array<() => void> = []

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
