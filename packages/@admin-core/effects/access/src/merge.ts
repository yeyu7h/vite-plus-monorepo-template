import type { AdminBackendMenu, AdminRouteMeta } from '@monorepo-admin-core/types'
import type { RouteRecordRaw } from 'vue-router'
import { resolveAdminRoutePath } from './path'

export interface MergeBackendMenusOptions {
  /** 为无需本地文件路由的 iframe 菜单提供占位组件 */
  iframeComponent?: RouteRecordRaw['component']
  /** 为无需本地文件路由的外链菜单提供占位组件 */
  externalLinkComponent?: RouteRecordRaw['component']
}

export function mergeBackendMenusWithFileRoutes(backendMenus: readonly AdminBackendMenu[], accessFileRoutes: readonly RouteRecordRaw[], options: MergeBackendMenusOptions = {}): RouteRecordRaw[] {
  const fileRouteMap = createRouteMap(accessFileRoutes)

  return backendMenus.flatMap((menu) => {
    const route = mergeBackendMenuWithFileRoute(menu, fileRouteMap, options)
    return route ? [route] : []
  })
}

function mergeBackendMenuWithFileRoute(
  menu: AdminBackendMenu,
  fileRouteMap: Map<string, RouteRecordRaw>,
  options: MergeBackendMenusOptions,
  parentPath = '',
  inheritedGroup?: AdminRouteMeta['group'],
): RouteRecordRaw | undefined {
  if (menu.type === 'button') return void 0

  const fullPath = resolveAdminRoutePath(parentPath, menu.path)
  const fileRoute = fileRouteMap.get(fullPath)
  const group = menu.meta.group ?? inheritedGroup
  const children = menu.children?.flatMap((child) => {
    const route = mergeBackendMenuWithFileRoute(child, fileRouteMap, options, fullPath, group)
    return route ? [route] : []
  })
  const iframeSrc = menu.meta.iframeSrc?.trim()
  const externalLink = menu.meta.externalLink?.trim()
  const canCreateIframeRoute = Boolean(iframeSrc && options.iframeComponent)
  const canCreateExternalLinkRoute = Boolean(externalLink && options.externalLinkComponent)

  // 普通菜单继续要求存在文件路由；iframe、外链和包含有效子路由的目录可以由后端配置生成
  if (!fileRoute && !canCreateIframeRoute && !canCreateExternalLinkRoute && !children?.length) {
    return void 0
  }

  const nextRoute = {
    ...fileRoute,
    ...(canCreateIframeRoute && !fileRoute?.component ? { component: options.iframeComponent } : {}),
    ...(canCreateExternalLinkRoute && !fileRoute?.component ? { component: options.externalLinkComponent } : {}),
    meta: {
      ...fileRoute?.meta,
      ...menu.meta,
      ...(iframeSrc ? { iframeSrc } : {}),
      ...(externalLink ? { externalLink } : {}),
      group,
      source: 'access',
    },
    path: resolveMergedRoutePath(parentPath, fullPath),
  } as RouteRecordRaw
  delete nextRoute.children

  if (children?.length) {
    nextRoute.children = children
  }

  return nextRoute
}

function createRouteMap(routes: readonly RouteRecordRaw[], parentPath = '', routeMap = new Map<string, RouteRecordRaw>()) {
  for (const route of routes) {
    const fullPath = resolveAdminRoutePath(parentPath, route.path)
    const candidate = { ...route } as RouteRecordRaw
    delete candidate.children

    routeMap.set(fullPath, candidate)

    if (route.children) {
      createRouteMap(route.children, fullPath, routeMap)
    }
  }

  return routeMap
}

function resolveMergedRoutePath(parentPath: string, fullPath: string) {
  if (!parentPath) return fullPath
  if (fullPath === parentPath) return ''

  const parentPrefix = parentPath === '/' ? '/' : `${parentPath}/`
  return fullPath.startsWith(parentPrefix) ? fullPath.slice(parentPrefix.length) : fullPath
}
