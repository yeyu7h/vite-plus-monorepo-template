import type { RouteRecordRaw, Router } from 'vue-router'
import { createAdminRoutePathMatcher, resolveAdminAccessGuard } from '@monorepo-admin-core/access-effect'
import { useAdminAuthStore } from '@/stores/auth'

function setupAccessGuard(router: Router, accessRoutes: readonly RouteRecordRaw[]) {
  const matchesAccessPath = createAdminRoutePathMatcher(accessRoutes)

  router.beforeEach((to) =>
    resolveAdminAccessGuard(to, useAdminAuthStore(), {
      matchesAccessPath,
      resolveRoute: (fullPath) => {
        const resolvedRoute = router.resolve(fullPath)

        return {
          hash: resolvedRoute.hash,
          path: resolvedRoute.path,
          query: resolvedRoute.query,
        }
      },
    }),
  )
}

export function createRouterGuard(router: Router, accessRoutes: readonly RouteRecordRaw[]) {
  setupAccessGuard(router, accessRoutes)
}
