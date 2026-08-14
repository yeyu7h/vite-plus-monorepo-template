import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router'
import { setupLayouts } from 'virtual:generated-layouts'
import { routes as fileRoutes, handleHotUpdate } from 'vue-router/auto-routes'
import { restoreAdminAccessRoutesForHmr } from './access/register'
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

if (import.meta.env.DEV && import.meta.hot) {
  handleHotUpdate(router, (nextFileRoutes) => {
    // 修复文件路由热更新使用原始路由替换路由表后，Layout 包装和已授权动态路由丢失的问题
    router.clearRoutes()

    for (const route of setupLayouts(selectInitialFileRoutes(nextFileRoutes))) {
      router.addRoute(route)
    }

    restoreAdminAccessRoutesForHmr(router)
  })
}

createRouterGuard(router, accessFileRoutes)

export { accessFileRoutes, router }
