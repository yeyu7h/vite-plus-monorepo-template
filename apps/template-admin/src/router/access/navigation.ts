import type { AdminNavigationRouteRecord } from '@monorepo-admin-core/types'
import type { RouteRecordRaw } from 'vue-router'
import { getAdminParentPath, normalizeAdminPath, resolveAdminRoutePath } from './path'

/**
 * 生成导航层使用的规范化路由记录
 *
 * 菜单、面包屑和标签页只消费这里生成的 canonical 字段，
 * 不再各自重复解析 activePath、parentPath 和 tabPath
 */
export function createAdminNavigationRoutes(routes: readonly RouteRecordRaw[], parentPath = ''): AdminNavigationRouteRecord[] {
  return routes.flatMap((route) => {
    const path = resolveAdminRoutePath(parentPath, route.path)
    const parent = getAdminParentPath(path)
    const activePath = normalizeAdminPath(route.meta?.activePath ?? path)
    const tabPath = route.meta?.hideInTab && route.meta.activePath ? normalizeAdminPath(route.meta.activePath) : path
    const currentRoute: AdminNavigationRouteRecord = {
      activePath,
      matched: void 0,
      meta: route.meta ?? {},
      parentPath: parent,
      path,
      source: route.meta?.source,
      tabPath,
    }
    const children = route.children ? createAdminNavigationRoutes(route.children, path) : []

    return [currentRoute, ...children]
  })
}
