import type { RouteRecordRaw } from 'vue-router'
import { createMemoryHistory, createRouter } from 'vue-router'

export function normalizeAdminPath(path: string) {
  if (!path) return '/'
  const pathname = path.split(/[?#]/)[0] ?? '/'
  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`
  const compacted = normalized.replace(/\/+/g, '/')

  if (compacted === '/') return compacted
  return compacted.replace(/\/$/, '')
}

export function resolveAdminRoutePath(parentPath: string, path: string) {
  if (path.startsWith('/')) return normalizeAdminPath(path)
  if (!parentPath) return normalizeAdminPath(`/${path}`)

  return normalizeAdminPath(`${parentPath}/${path}`)
}

export function getAdminParentPath(path: string) {
  const normalizedPath = normalizeAdminPath(path)
  if (normalizedPath === '/') return void 0

  const segments = normalizedPath.split('/').filter(Boolean)
  if (segments.length <= 1) return void 0

  return `/${segments.slice(0, -1).join('/')}`
}

export function collectRawRoutePaths(routes: readonly RouteRecordRaw[], parentPath = ''): string[] {
  return routes.flatMap((route) => {
    const path = resolveAdminRoutePath(parentPath, route.path)
    const children = route.children ? collectRawRoutePaths(route.children, path) : []

    return [path, ...children]
  })
}

export function createAdminRoutePathMatcher(routes: readonly RouteRecordRaw[]) {
  const matcherRouter = createRouter({
    history: createMemoryHistory(),
    routes: [...routes],
  })

  return (path: string) => matcherRouter.resolve(normalizeAdminPath(path)).matched.length > 0
}

export function filterRawRouteRecords(routes: readonly RouteRecordRaw[], predicate: (route: RouteRecordRaw) => boolean): RouteRecordRaw[] {
  return routes.flatMap((route) => {
    const children = route.children ? filterRawRouteRecords(route.children, predicate) : []

    if (!predicate(route) && children.length === 0) return []

    const nextRoute = { ...route } as RouteRecordRaw
    delete nextRoute.children

    if (children.length) {
      nextRoute.children = children
    }

    return [nextRoute]
  })
}
