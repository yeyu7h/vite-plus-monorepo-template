import type { RouteRecordRaw, Router } from 'vue-router'
import { setupLayouts } from 'virtual:generated-layouts'

// 保存当前批次 router.addRoute() 返回的移除函数，确保替换或退出登录时能完整清理动态路由
const dynamicRouteRemovers: Array<() => void> = []
// 保存未经 Layout 包装的授权路由快照，供开发环境 HMR 清空路由表后恢复
let registeredAccessRoutes: RouteRecordRaw[] = []

/** 使用最新的权限计算结果替换当前动态路由。 */
export function registerAdminAccessRoutes(router: Router, routes: readonly RouteRecordRaw[]) {
  removeAdminAccessRoutes()
  registeredAccessRoutes = cloneRouteRecords(routes)

  addAdminAccessRoutes(router, registeredAccessRoutes)
}

/** 清除当前动态路由及其缓存，避免退出登录后被 HMR 再次恢复 */
export function resetAdminAccessRoutes() {
  removeAdminAccessRoutes()
  registeredAccessRoutes = []
}

function addAdminAccessRoutes(router: Router, routes: readonly RouteRecordRaw[]) {
  // `setupLayouts()` 会改写嵌套 `children`，因此每次都基于新副本进行包装
  for (const route of setupLayouts(cloneRouteRecords(routes))) {
    dynamicRouteRemovers.push(router.addRoute(route))
  }
}

/**
 * 深拷贝路由树结构，同时保留组件和重定向等字段的原始引用
 * @param routes
 */
function cloneRouteRecords(routes: readonly RouteRecordRaw[]): RouteRecordRaw[] {
  return routes.map((route) => {
    const nextRoute = { ...route } as RouteRecordRaw
    if (route.children) nextRoute.children = cloneRouteRecords(route.children)

    return nextRoute
  })
}

function removeAdminAccessRoutes() {
  while (dynamicRouteRemovers.length) dynamicRouteRemovers.pop()?.() // 使用 `pop()` 同时清空移除函数，防止后续重复调用旧回调
}

/**
 * 仅供开发环境下的文件路由 HMR 使用。
 * 修复 Vue Router 热替换清空路由表后，当前已授权的动态路由及其 Layout 包装丢失的问题
 */
export function restoreAdminAccessRoutesForHmr(router: Router) {
  removeAdminAccessRoutes()
  addAdminAccessRoutes(router, registeredAccessRoutes)
}
