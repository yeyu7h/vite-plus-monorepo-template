import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router'
import { setupLayouts } from 'virtual:generated-layouts'
import { routes as fileRoutes, handleHotUpdate } from 'vue-router/auto-routes'
import { useAdminAccessStore } from '@/stores/access'
import { normalizeAdminPath, splitAdminFileRoutes } from './access'

const { accessFileRoutes, coreRoutes, fallbackRoutes } = splitAdminFileRoutes(fileRoutes)
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

router.beforeEach(async (to) => {
  const accessStore = useAdminAccessStore()
  const normalizedPath = normalizeAdminPath(to.path)

  if (normalizedPath === '/') {
    return accessStore.isLoggedIn ? (accessStore.userInfo?.homePath ?? '/dashboard/workbench') : '/auth/login'
  }

  if (isPublicRoutePath(normalizedPath)) {
    if (normalizedPath === '/auth/login' && accessStore.isLoggedIn) {
      try {
        await accessStore.restoreAccess()
        return accessStore.userInfo?.homePath ?? '/dashboard/workbench'
      } catch {
        return true
      }
    }

    return true
  }

  if (!accessStore.isLoggedIn) {
    return {
      path: '/auth/login',
      query: normalizedPath === '/dashboard/workbench' ? {} : { redirect: encodeURIComponent(to.fullPath) },
      replace: true,
    }
  }

  let accessGenerated = false
  try {
    accessGenerated = await accessStore.restoreAccess()
  } catch {
    return {
      path: '/auth/login',
      query: { redirect: encodeURIComponent(to.fullPath) },
      replace: true,
    }
  }

  if (accessGenerated) {
    return {
      ...router.resolve(to.fullPath),
      replace: true,
    }
  }

  return true
})

export { accessFileRoutes, router }

function isPublicRoutePath(path: string) {
  return path.startsWith('/auth') || path === '/403' || path === '/404'
}

function isLayoutlessInitialRoute(route: (typeof initialRoutes)[number]) {
  const path = normalizeAdminPath(route.path)

  return path === '/auth/login' || path === '/404' || path.includes(':pathMatch') || path.includes('(.*)') || path.includes('...')
}
