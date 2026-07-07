import type { AdminMenuGroup, AdminMenuGroupMeta, AdminMenuItem, AdminRouteMeta } from '@monorepo-admin-core/types'

export interface AdminRouteRecord {
  meta: AdminRouteMeta
  path: string
}

interface MenuNode extends Omit<AdminMenuItem, 'children'> {
  children: MenuNode[]
  ownRoute: boolean
}

export interface BuildAdminMenusOptions {
  maxDepth?: number
}

export interface BuildAdminMenuGroupsOptions extends BuildAdminMenusOptions {
  defaultGroup?: AdminMenuGroupMeta
}

interface ResolvedMenuGroupMeta {
  id: string
  label?: string
  order?: number
}

interface MenuGroupBucket {
  meta: ResolvedMenuGroupMeta
  routes: AdminRouteRecord[]
}

const MAX_MENU_DEPTH = 2
const DEFAULT_MAX_DEPTH = MAX_MENU_DEPTH
const DEFAULT_GROUP_MAX_DEPTH = MAX_MENU_DEPTH
const DEFAULT_MENU_GROUP_ID = 'default'

export function buildAdminMenus(routes: readonly AdminRouteRecord[], options: BuildAdminMenusOptions = {}): AdminMenuItem[] {
  const maxDepth = resolveMenuMaxDepth(options.maxDepth)
  const nodes = new Map<string, MenuNode>()
  const roots: MenuNode[] = []
  const routeByPath = new Map<string, AdminRouteRecord>()

  const visibleRoutes = routes.map((route) => ({ ...route, path: normalizeMenuPath(route.path) })).filter((route) => isMenuRoute(route))

  for (const route of visibleRoutes) {
    routeByPath.set(route.path, route)
  }

  for (const route of visibleRoutes) {
    const segments = route.path.split('/').filter(Boolean)
    const depth = Math.min(segments.length, maxDepth)
    let parent: MenuNode | undefined

    for (let index = 0; index < depth; index += 1) {
      const segment = segments[index]
      if (!segment) continue

      const nodeId = `/${segments.slice(0, index + 1).join('/')}`
      const ancestorRoute = routeByPath.get(nodeId)
      const nodeRoute = index === depth - 1 ? route : ancestorRoute
      const node = ensureMenuNode(nodes, nodeId, segment, nodeRoute)

      if (parent) {
        appendUniqueChild(parent, node)
      } else if (!roots.includes(node)) {
        roots.push(node)
      }

      parent = node
    }
  }

  return roots.map(finalizeMenuNode).sort(compareMenuItems)
}

export function buildAdminMenuGroups(routes: readonly AdminRouteRecord[], options: BuildAdminMenuGroupsOptions = {}): AdminMenuGroup[] {
  const maxDepth = resolveMenuMaxDepth(options.maxDepth ?? DEFAULT_GROUP_MAX_DEPTH)
  const buckets = new Map<string, MenuGroupBucket>()
  const visibleRoutes = routes.map((route) => ({ ...route, path: normalizeMenuPath(route.path) })).filter((route) => isMenuRoute(route))

  for (const route of visibleRoutes) {
    const meta = resolveMenuGroupMeta(route.meta.menuGroup, options.defaultGroup)
    const bucket = ensureMenuGroupBucket(buckets, meta)
    bucket.routes.push(route)
  }

  return [...buckets.values()]
    .map((bucket) => ({
      children: buildAdminMenus(bucket.routes, { maxDepth }),
      id: bucket.meta.id,
      label: bucket.meta.label,
      order: bucket.meta.order,
    }))
    .filter((group) => group.children.length > 0)
    .sort(compareMenuGroups)
}

export function markActiveAdminMenuGroups(groups: readonly AdminMenuGroup[], activePath: string): AdminMenuGroup[] {
  return groups.map((group) => ({
    ...group,
    children: markActiveAdminMenus(group.children, activePath),
  }))
}

export function markActiveAdminMenus(items: readonly AdminMenuItem[], activePath: string): AdminMenuItem[] {
  const normalizedActivePath = normalizeMenuPath(activePath)

  return items.map((item) => {
    const children = item.children ? markActiveAdminMenus(item.children, normalizedActivePath) : undefined
    const childActive = children?.some((child) => child.active) ?? false
    const selfActive = isMenuActive(item, normalizedActivePath)

    return {
      ...item,
      active: selfActive || childActive,
      children,
    }
  })
}

function ensureMenuNode(nodes: Map<string, MenuNode>, id: string, segment: string, route?: AdminRouteRecord): MenuNode {
  const existing = nodes.get(id)
  const node =
    existing ??
    ({
      children: [],
      id,
      ownRoute: false,
      path: id,
      title: formatSegmentTitle(segment),
    } satisfies MenuNode)

  if (route) {
    node.activePath = route.meta.activePath
    node.authority = route.meta.authority
    node.externalLink = route.meta.externalLink
    node.icon = route.meta.icon
    node.order = route.meta.order
    node.ownRoute = true
    node.path = route.meta.externalLink ?? route.path
    node.title = route.meta.title ?? node.title
  }

  nodes.set(id, node)
  return node
}

function appendUniqueChild(parent: MenuNode, child: MenuNode) {
  if (!parent.children.includes(child)) {
    parent.children.push(child)
  }
}

function finalizeMenuNode(node: MenuNode): AdminMenuItem {
  const children = node.children.map(finalizeMenuNode).sort(compareMenuItems)
  const firstChildPath = children[0]?.path
  const order = node.order ?? resolveMenuOrder(children)

  return {
    activePath: node.activePath,
    authority: node.authority,
    children: children.length > 0 ? children : undefined,
    externalLink: node.externalLink,
    icon: node.icon,
    id: node.id,
    order,
    path: node.ownRoute ? node.path : (firstChildPath ?? node.path),
    title: node.title,
  }
}

function compareMenuItems(a: AdminMenuItem, b: AdminMenuItem) {
  return (a.order ?? 0) - (b.order ?? 0) || a.title.localeCompare(b.title) || a.id.localeCompare(b.id)
}

function compareMenuGroups(a: AdminMenuGroup, b: AdminMenuGroup) {
  return (a.order ?? 0) - (b.order ?? 0) || (a.label ?? '').localeCompare(b.label ?? '') || a.id.localeCompare(b.id)
}

function resolveMenuOrder(children: readonly AdminMenuItem[]) {
  if (children.length === 0) return 0
  return Math.min(...children.map((child) => child.order ?? 0))
}

function resolveMenuMaxDepth(maxDepth = DEFAULT_MAX_DEPTH) {
  return Math.max(1, Math.min(maxDepth, MAX_MENU_DEPTH))
}

function resolveMenuGroupMeta(menuGroup: AdminRouteMeta['menuGroup'], defaultGroup?: AdminMenuGroupMeta): ResolvedMenuGroupMeta {
  if (typeof menuGroup === 'string') {
    return {
      id: `group:${menuGroup}`,
      label: menuGroup,
    }
  }

  if (menuGroup) {
    return {
      id: menuGroup.id ?? `group:${menuGroup.label}`,
      label: menuGroup.label,
      order: menuGroup.order,
    }
  }

  return {
    id: defaultGroup?.id ?? DEFAULT_MENU_GROUP_ID,
    label: defaultGroup?.label,
    order: defaultGroup?.order,
  }
}

function ensureMenuGroupBucket(buckets: Map<string, MenuGroupBucket>, meta: ResolvedMenuGroupMeta): MenuGroupBucket {
  const existing = buckets.get(meta.id)
  if (existing) return existing

  const bucket = {
    meta,
    routes: [],
  } satisfies MenuGroupBucket

  buckets.set(meta.id, bucket)
  return bucket
}

function isMenuRoute(route: AdminRouteRecord) {
  return Boolean(route.meta.title && !route.meta.hideInMenu && isStaticMenuPath(route.path))
}

function isStaticMenuPath(path: string) {
  return path !== '/' && !path.includes(':') && !path.includes('*') && !path.includes('(')
}

function isMenuActive(item: AdminMenuItem, activePath: string) {
  const itemPath = normalizeMenuPath(item.activePath ?? item.id)
  const navigationPath = normalizeMenuPath(item.path)

  return activePath === itemPath || activePath.startsWith(`${itemPath}/`) || activePath === navigationPath
}

function normalizeMenuPath(path: string) {
  if (!path) return '/'
  if (/^https?:\/\//.test(path)) return path

  const normalized = path.startsWith('/') ? path : `/${path}`
  return normalized.length > 1 ? normalized.replace(/\/+$/, '') : normalized
}

function formatSegmentTitle(segment: string) {
  return segment
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}
