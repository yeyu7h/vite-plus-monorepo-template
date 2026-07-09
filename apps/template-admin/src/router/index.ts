import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router'
import { setupLayouts } from 'virtual:generated-layouts'
import { routes as fileRoutes, handleHotUpdate } from 'vue-router/auto-routes'
import { useAdminAccessStore } from '@/stores/access'
import { normalizeAdminPath, resolveAdminAccessGuard, splitAdminFileRoutes } from './access'

const { accessFileRoutes, coreRoutes, fallbackRoutes } = splitAdminFileRoutes(fileRoutes)
const accessRoutePathSet = new Set(accessFileRoutes.map((route) => normalizeAdminPath(route.path)))
const initialRoutes = [...coreRoutes, ...fallbackRoutes]
const layoutlessInitialRoutes = initialRoutes.filter(isLayoutlessInitialRoute)
const layoutInitialRoutes = initialRoutes.filter((route) => !isLayoutlessInitialRoute(route))

const router = createRouter({
  history: import.meta.env.VITE_ROUTER_HISTORY === 'hash' ? createWebHashHistory(import.meta.env.VITE_BASE) : createWebHistory(import.meta.env.VITE_BASE),

  scrollBehavior: (to, _from, position) => {
    if (position) return position
    return to.hash ? { behavior: 'smooth', el: to.hash } : { left: 0, top: 0 }
  },

  routes: [...layoutlessInitialRoutes, ...setupLayouts(layoutInitialRoutes)],
})

if (import.meta.hot) handleHotUpdate(router)

router.beforeEach((to) =>
  resolveAdminAccessGuard(to, useAdminAccessStore(), {
    accessRoutePathSet,
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

export { accessFileRoutes, router }

function isLayoutlessInitialRoute(route: (typeof initialRoutes)[number]) {
  const path = normalizeAdminPath(route.path)

  return path === '/auth/login' || path === '/404' || path.includes(':pathMatch') || path.includes('(.*)') || path.includes('...')
}
