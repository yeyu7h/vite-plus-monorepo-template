import type { AdminNavigationRouteNode, AdminNavigationRouteRecord, AdminRouteMeta } from '@monorepo-admin-core/types'
import type { RouteRecordRaw } from 'vue-router'
import { hasAdminRouteTarget, normalizeAdminPath, resolveAdminRoutePath } from './path'

/** 将已完成分组继承和权限过滤的路由树转换为规范化导航树 */
export function createAdminNavigationTree(routes: readonly RouteRecordRaw[], parentPath = ''): AdminNavigationRouteNode[] {
  return routes.map((route) => {
    const meta = (route.meta ?? {}) as AdminRouteMeta
    const path = resolveAdminRoutePath(parentPath, route.path)
    const activePath = normalizeAdminPath(meta.activePath ?? path)
    const tabPath = normalizeAdminPath(meta.tabPath ?? path)
    return {
      id: meta.menuId ?? path,
      type: meta.menuType ?? (hasAdminRouteTarget(route) ? 'menu' : 'directory'),
      navigable: hasAdminRouteTarget(route),
      activePath,
      meta,
      // Menu hierarchy comes only from the route tree (backend menu children), not from URL segments / 菜单层级只来自路由树（即后端菜单 children），不能从 URL 片段反推
      parentPath: parentPath ? normalizeAdminPath(parentPath) : void 0,
      path,
      source: meta.source,
      tabPath,
      children: route.children ? createAdminNavigationTree(route.children, path) : void 0,
    }
  })
}

/** 扁平记录只供面包屑等查询使用，不再用于重建菜单 */
export function flattenAdminNavigationTree(nodes: readonly AdminNavigationRouteNode[]): AdminNavigationRouteRecord[] {
  return nodes.flatMap(({ id: _id, type: _type, navigable: _navigable, children, ...record }) => [record, ...flattenAdminNavigationTree(children ?? [])])
}

export function createAdminNavigationRoutes(routes: readonly RouteRecordRaw[], parentPath = ''): AdminNavigationRouteRecord[] {
  return flattenAdminNavigationTree(createAdminNavigationTree(routes, parentPath))
}
