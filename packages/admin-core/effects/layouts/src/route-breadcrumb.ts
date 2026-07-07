import type { AdminBreadcrumbItem, AdminRouteMeta } from '@monorepo-admin-core/types'

export interface AdminBreadcrumbRouteRecord {
  meta: AdminRouteMeta
  path: string
}

export interface AdminCurrentRouteRecord {
  matched?: readonly AdminBreadcrumbRouteRecord[]
  meta: AdminRouteMeta
  path: string
}

export function buildAdminBreadcrumbs(route: AdminCurrentRouteRecord, routes: readonly AdminBreadcrumbRouteRecord[] = []): AdminBreadcrumbItem[] {
  const currentPath = normalizeBreadcrumbPath(route.path)

  if (currentPath === '/') {
    if (!route.meta.title || route.meta.hideInBreadcrumb) return []
    return [createBreadcrumbItem(route.meta, route.meta.title, undefined)]
  }

  const routeByPath = createRouteByPath(routes, route.matched)
  const segments = currentPath.split('/').filter(Boolean)

  return segments.flatMap((segment, index) => {
    const path = `/${segments.slice(0, index + 1).join('/')}`
    const matchedRoute = path === currentPath ? route : routeByPath.get(path)
    const meta = matchedRoute?.meta

    if (meta?.hideInBreadcrumb) return []

    const title = meta?.title ?? formatSegmentTitle(segment)
    return [createBreadcrumbItem(meta, title, undefined)]
  })
}

function createRouteByPath(routes: readonly AdminBreadcrumbRouteRecord[], matched: readonly AdminBreadcrumbRouteRecord[] = []) {
  const routeByPath = new Map(routes.map((item) => [normalizeBreadcrumbPath(item.path), item]))

  for (const item of matched) {
    routeByPath.set(normalizeBreadcrumbPath(item.path), item)
  }

  return routeByPath
}

export function buildAdminBreadcrumbPrefix(route: AdminCurrentRouteRecord): AdminBreadcrumbItem[] {
  const menuGroup = route.meta.menuGroup
  const title = typeof menuGroup === 'string' ? menuGroup : menuGroup?.label

  if (!title) return []

  return [
    {
      title,
    },
  ]
}

function createBreadcrumbItem(meta: AdminRouteMeta | undefined, title: string, path: string | undefined): AdminBreadcrumbItem {
  return {
    icon: meta?.icon,
    path,
    title,
  }
}

function normalizeBreadcrumbPath(path: string) {
  if (!path) return '/'

  const pathname = path.split(/[?#]/)[0] ?? '/'
  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`
  return normalized.length > 1 ? normalized.replace(/\/+$/, '') : normalized
}

function formatSegmentTitle(segment: string) {
  return segment
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}
