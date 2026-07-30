import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router'
import { setupLayouts } from 'virtual:generated-layouts'
import { routes as fileRoutes, handleHotUpdate } from 'vue-router/auto-routes'
import { selectAccessFileRoutes, selectInitialFileRoutes } from './file-routes'
import { createRouterGuard } from './guard'

const initialRoutes = selectInitialFileRoutes(fileRoutes)
const accessFileRoutes = selectAccessFileRoutes(fileRoutes)

const router = createRouter({
  history: import.meta.env.VITE_ROUTER_HISTORY === 'hash' ? createWebHashHistory(import.meta.env.VITE_BASE) : createWebHistory(import.meta.env.VITE_BASE),

  scrollBehavior: (to, _from, position) => {
    if (position) return position
    return to.hash ? { behavior: 'smooth', el: to.hash } : { left: 0, top: 0 }
  },

  routes: setupLayouts(initialRoutes),
})

if (import.meta.hot) handleHotUpdate(router)

createRouterGuard(router, accessFileRoutes)

export { accessFileRoutes, router }
