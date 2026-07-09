import type { RouteRecordRaw } from 'vue-router'

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

export function flattenRawRouteRecords(routes: readonly RouteRecordRaw[], parentPath = ''): RouteRecordRaw[] {
  return routes.flatMap((route) => {
    const path = resolveAdminRoutePath(parentPath, route.path)
    const currentRoute = {
      ...route,
      path,
    } as RouteRecordRaw
    const children = route.children ? flattenRawRouteRecords(route.children, path) : []

    return [currentRoute, ...children]
  })
}
