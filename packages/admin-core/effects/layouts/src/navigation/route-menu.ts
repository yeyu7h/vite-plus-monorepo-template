import type { AdminMenuGroup, AdminMenuGroupMeta, AdminMenuItem, AdminNavigationRouteRecord, AdminRouteMeta } from '@monorepo-admin-core/types'
import { normalizeAdminNavigationPath } from './shared'

interface MenuNode extends Omit<AdminMenuItem, 'children'> {
  /** 组装过程中的子节点集合 */
  children: MenuNode[]
}

export interface BuildAdminMenusOptions {
  /** 允许生成的最大菜单深度 */
  maxDepth?: number
}

export interface BuildAdminMenuGroupsOptions extends BuildAdminMenusOptions {
  /** 未声明 `menuGroup` 时使用的默认分组信息 */
  defaultGroup?: AdminMenuGroupMeta
}

interface ResolvedMenuGroupMeta {
  /** 分组稳定标识 */
  id: string
  /** 分组显示标题 */
  label?: string
  /** 分组排序权重 */
  order?: number
}

interface MenuGroupBucket {
  /** 当前桶对应的分组信息 */
  meta: ResolvedMenuGroupMeta
  /** 被收集到当前分组下的路由列表 */
  routes: AdminNavigationRouteRecord[]
}

const MAX_MENU_DEPTH = 3
const DEFAULT_MAX_DEPTH = MAX_MENU_DEPTH
const DEFAULT_GROUP_MAX_DEPTH = MAX_MENU_DEPTH
const DEFAULT_MENU_GROUP_ID = 'default'

/**
 * 从路由列表生成菜单树
 * @param routes 路由列表
 * @param options 生成选项
 */
export function buildAdminMenus(routes: readonly AdminNavigationRouteRecord[], options: BuildAdminMenusOptions = {}): AdminMenuItem[] {
  const maxDepth = resolveMenuMaxDepth(options.maxDepth)
  const nodes = new Map<string, MenuNode>()
  const roots: MenuNode[] = []
  const visibleRoutes = routes
    .map((route) => ({
      ...route,
      parentPath: route.parentPath ? normalizeAdminNavigationPath(route.parentPath) : void 0,
      path: normalizeAdminNavigationPath(route.path),
    }))
    .filter((route) => isMenuRoute(route))
  const routeByPath = new Map(visibleRoutes.map((route) => [route.path, route]))

  for (const route of visibleRoutes) {
    nodes.set(route.path, createMenuNode(route))
  }

  for (const route of visibleRoutes) {
    const node = nodes.get(route.path)!
    const parentPath = resolveMenuParentPath(route, routeByPath, maxDepth)
    const parent = parentPath ? nodes.get(parentPath) : void 0

    if (parent) {
      appendUniqueChild(parent, node)
    } else if (!roots.includes(node)) {
      roots.push(node)
    }
  }

  return roots.map((node) => finalizeMenuNode(node)).sort(compareMenuItems)
}

/**
 * 从路由列表生成按 `menuGroup` 划分的菜单分组
 * @param routes 路由列表
 * @param options 生成选项
 */
export function buildAdminMenuGroups(routes: readonly AdminNavigationRouteRecord[], options: BuildAdminMenuGroupsOptions = {}): AdminMenuGroup[] {
  const maxDepth = resolveMenuMaxDepth(options.maxDepth ?? DEFAULT_GROUP_MAX_DEPTH)
  const buckets = new Map<string, MenuGroupBucket>()
  const visibleRoutes = routes
    .map((route) => ({
      ...route,
      parentPath: route.parentPath ? normalizeAdminNavigationPath(route.parentPath) : void 0,
      path: normalizeAdminNavigationPath(route.path),
    }))
    .filter((route) => isMenuRoute(route))
  const routeByPath = new Map(visibleRoutes.map((route) => [route.path, route]))

  for (const route of visibleRoutes) {
    const meta = resolveMenuGroupMeta(resolveInheritedMenuGroup(route, routeByPath), options.defaultGroup)
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

/**
 * 子级未声明分组时继承最近父级分组 避免同一菜单树被拆到默认分组产生占位父菜单
 * @param route 当前路由
 * @param routeByPath 可见路由索引
 */
function resolveInheritedMenuGroup(route: AdminNavigationRouteRecord, routeByPath: ReadonlyMap<string, AdminNavigationRouteRecord>) {
  if (route.meta.menuGroup) return route.meta.menuGroup

  let parentPath = route.parentPath
  const visited = new Set<string>()

  while (parentPath && !visited.has(parentPath)) {
    visited.add(parentPath)
    const parentRoute = routeByPath.get(parentPath)
    const menuGroup = parentRoute?.meta.menuGroup

    if (menuGroup) return menuGroup
    parentPath = parentRoute?.parentPath
  }
}

/**
 * 标记分组菜单中的激活项 不修改原始分组结构
 * @param groups 菜单分组
 * @param activePath 当前激活路径
 */
export function markActiveAdminMenuGroups(groups: readonly AdminMenuGroup[], activePath: string): AdminMenuGroup[] {
  return groups.map((group) => ({
    ...group,
    children: markActiveAdminMenus(group.children, activePath),
  }))
}

/**
 * 标记菜单树中的激活项 并向上冒泡到祖先节点
 * @param items 菜单树
 * @param activePath 当前激活路径
 */
export function markActiveAdminMenus(items: readonly AdminMenuItem[], activePath: string): AdminMenuItem[] {
  const normalizedActivePath = normalizeAdminNavigationPath(activePath)

  return items.map((item) => {
    const children = item.children ? markActiveAdminMenus(item.children, normalizedActivePath) : void 0
    const childActive = children?.some((child) => child.active) ?? false
    const selfActive = isMenuActive(item, normalizedActivePath)

    return {
      ...item,
      active: selfActive || childActive,
      children,
    }
  })
}

/**
 * 从真实路由创建菜单节点 不再根据 URL 片段生成占位父节点
 * @param route 后端菜单树生成的导航路由
 */
function createMenuNode(route: AdminNavigationRouteRecord): MenuNode {
  return {
    activePath: route.activePath ?? route.meta.activePath,
    authority: route.meta.authority,
    children: [],
    externalLink: route.meta.externalLink,
    icon: route.meta.icon,
    id: route.path,
    order: route.meta.order,
    path: route.meta.externalLink ?? route.path,
    title: route.meta.title!,
  }
}

/**
 * 按后端父子链解析菜单父节点 超过最大深度时提升到允许的最深层级
 * @param route 当前路由
 * @param routeByPath 当前菜单分组内的可见路由索引
 * @param maxDepth 菜单允许的最大深度
 */
function resolveMenuParentPath(route: AdminNavigationRouteRecord, routeByPath: ReadonlyMap<string, AdminNavigationRouteRecord>, maxDepth: number) {
  const ancestors: AdminNavigationRouteRecord[] = []
  const visited = new Set<string>([route.path])
  let parentPath = route.parentPath

  while (parentPath && !visited.has(parentPath)) {
    visited.add(parentPath)
    const parent = routeByPath.get(parentPath)
    if (!parent) break
    ancestors.unshift(parent)
    parentPath = parent.parentPath
  }

  if (ancestors.length === 0 || maxDepth === 1) {
    if (ancestors.length >= maxDepth) warnPromotedMenuRoute(route.path, maxDepth)
    return void 0
  }

  const depth = ancestors.length + 1
  if (depth <= maxDepth) return ancestors.at(-1)?.path

  warnPromotedMenuRoute(route.path, maxDepth)
  return ancestors[maxDepth - 2]?.path
}

/**
 * 仅在子节点不存在时追加 避免同一路由链重复挂载
 * @param parent 父节点
 * @param child 子节点
 */
function appendUniqueChild(parent: MenuNode, child: MenuNode) {
  if (!parent.children.includes(child)) {
    parent.children.push(child)
  }
}

/**
 * 将构建阶段的节点结构压平成对外暴露的菜单项
 * @param node 构建阶段节点
 */
function finalizeMenuNode(node: MenuNode, depth = 1): AdminMenuItem {
  const children = node.children.map((child) => finalizeMenuNode(child, depth + 1)).sort(compareMenuItems)
  const order = node.order ?? resolveMenuOrder(children)

  return {
    activePath: node.activePath,
    authority: node.authority,
    children: children.length > 0 ? children : void 0,
    externalLink: node.externalLink,
    icon: depth < MAX_MENU_DEPTH ? node.icon : void 0,
    id: node.id,
    order,
    path: node.path,
    title: node.title,
  }
}

/**
 * 菜单项排序 先按权重 再按标题 最后按稳定 id
 * @param a 菜单项 A
 * @param b 菜单项 B
 */
function compareMenuItems(a: AdminMenuItem, b: AdminMenuItem) {
  return (a.order ?? 0) - (b.order ?? 0) || a.title.localeCompare(b.title) || a.id.localeCompare(b.id)
}

/**
 * 菜单分组排序 先按权重 再按标题 最后按稳定 id
 * @param a 菜单分组 A
 * @param b 菜单分组 B
 */
function compareMenuGroups(a: AdminMenuGroup, b: AdminMenuGroup) {
  return (a.order ?? 0) - (b.order ?? 0) || (a.label ?? '').localeCompare(b.label ?? '') || a.id.localeCompare(b.id)
}

/**
 * 从子节点中推导父节点的默认排序权重
 * @param children 子菜单列表
 */
function resolveMenuOrder(children: readonly AdminMenuItem[]) {
  if (children.length === 0) return 0
  return Math.min(...children.map((child) => child.order ?? 0))
}

/**
 * 约束菜单最大深度 避免渲染层和数据层出现不一致
 * @param maxDepth 配置深度
 */
function resolveMenuMaxDepth(maxDepth = DEFAULT_MAX_DEPTH) {
  return Math.max(1, Math.min(maxDepth, MAX_MENU_DEPTH))
}

/**
 * 提示深层路由已被投影到菜单允许的最深层级
 * @param path 被提升的完整路由路径
 * @param maxDepth 菜单允许的最大深度
 */
function warnPromotedMenuRoute(path: string, maxDepth: number) {
  console.warn(`[admin-menu] 路由 "${path}" 超过 ${maxDepth} 级菜单限制，已自动提升为第 ${maxDepth} 级菜单项；如无需展示，请设置 meta.hideInMenu`)
}

/**
 * 将 route meta 中的 `menuGroup` 解析为统一的分组信息结构
 * @param menuGroup 原始分组配置
 * @param defaultGroup 默认分组配置
 */
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

/**
 * 获取或创建分组收集桶
 * @param buckets 分组桶索引
 * @param meta 分组信息
 */
function ensureMenuGroupBucket(buckets: Map<string, MenuGroupBucket>, meta: ResolvedMenuGroupMeta): MenuGroupBucket {
  const existing = buckets.get(meta.id)
  if (existing) return existing

  // 分组桶只负责收集路由 最终菜单树在统一排序后再生成
  const bucket = {
    meta,
    routes: [],
  } satisfies MenuGroupBucket

  buckets.set(meta.id, bucket)
  return bucket
}

/**
 * 判断路由是否应该进入自动菜单生成
 * @param route 待判断路由
 */
function isMenuRoute(route: AdminNavigationRouteRecord) {
  return Boolean(route.meta.title && !route.meta.hideInMenu && isStaticMenuPath(route.path))
}

/**
 * 过滤掉动态路由 通配路由等不适合直接渲染成菜单的路径
 * @param path 待判断路径
 */
function isStaticMenuPath(path: string) {
  return path !== '/' && !path.includes(':') && !path.includes('*') && !path.includes('(')
}

/**
 * 判断当前菜单项是否命中激活路径
 * @param item 菜单项
 * @param activePath 当前激活路径
 */
function isMenuActive(item: AdminMenuItem, activePath: string) {
  const itemPath = normalizeAdminNavigationPath(item.activePath ?? item.id)
  const navigationPath = normalizeAdminNavigationPath(item.path)

  return activePath === itemPath || activePath.startsWith(`${itemPath}/`) || activePath === navigationPath
}
