import type { AdminMenuGroup, AdminMenuGroupMeta, AdminMenuItem, AdminNavigationRouteRecord, AdminRouteMeta } from '@monorepo-admin-core/types'
import { formatAdminNavigationTitle, normalizeAdminNavigationPath } from './shared'

interface MenuNode extends Omit<AdminMenuItem, 'children'> {
  /** 组装过程中的子节点集合 */
  children: MenuNode[]
  /** 当前节点是否对应一个真实路由 而不是中间层级占位节点 */
  ownRoute: boolean
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
  const routeByPath = new Map<string, AdminNavigationRouteRecord>()

  // 先按规范化后的路径建立索引 这样子级路由在补父节点时能回捞到真实父级 meta
  const visibleRoutes = routes.map((route) => ({ ...route, path: normalizeAdminNavigationPath(route.path) })).filter((route) => isMenuRoute(route))

  for (const route of visibleRoutes) {
    routeByPath.set(route.path, route)
  }

  for (const route of visibleRoutes) {
    const segments = route.path.split('/').filter(Boolean)
    const depth = Math.min(segments.length, maxDepth)
    const shouldPromote = segments.length > maxDepth
    let parent: MenuNode | undefined

    if (shouldPromote) warnPromotedMenuRoute(route.path, maxDepth)

    // 逐级补齐父节点 深层路由保留完整路径并提升到菜单允许的最深层级 避免共享路径前缀的路由互相覆盖
    for (let index = 0; index < depth; index += 1) {
      const isPromotedLeaf = shouldPromote && index === depth - 1
      const segment = isPromotedLeaf ? segments.at(-1) : segments[index]
      if (!segment) continue

      const nodeId = isPromotedLeaf ? route.path : `/${segments.slice(0, index + 1).join('/')}`
      const ancestorRoute = routeByPath.get(nodeId)
      // 只有最深一层直接使用当前路由 中间层优先复用已存在的祖先路由信息
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
  const visibleRoutes = routes.map((route) => ({ ...route, path: normalizeAdminNavigationPath(route.path) })).filter((route) => isMenuRoute(route))
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

  let parentPath = route.parentPath ?? getParentNavigationPath(route.path)

  while (parentPath) {
    const menuGroup = routeByPath.get(parentPath)?.meta.menuGroup

    if (menuGroup) return menuGroup
    parentPath = getParentNavigationPath(parentPath)
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
 * 获取或创建某一级菜单节点 并在命中真实路由时补齐元信息
 * @param nodes 已创建节点索引
 * @param id 节点 id
 * @param segment 当前路径片段
 * @param route 命中的真实路由
 */
function ensureMenuNode(nodes: Map<string, MenuNode>, id: string, segment: string, route?: AdminNavigationRouteRecord): MenuNode {
  const existing = nodes.get(id)
  const node =
    existing ??
    ({
      children: [],
      id,
      ownRoute: false,
      path: id,
      title: formatAdminNavigationTitle(segment),
    } satisfies MenuNode)

  if (route) {
    node.activePath = route.activePath ?? route.meta.activePath
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
  const firstChildPath = children[0]?.path
  // 占位父节点没有自己的跳转目标时 默认落到第一个子节点
  const order = node.order ?? resolveMenuOrder(children)

  return {
    activePath: node.activePath,
    authority: node.authority,
    children: children.length > 0 ? children : void 0,
    externalLink: node.externalLink,
    icon: depth < MAX_MENU_DEPTH ? node.icon : void 0,
    id: node.id,
    order,
    path: node.ownRoute ? node.path : (firstChildPath ?? node.path),
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

function getParentNavigationPath(path: string) {
  const segments = normalizeAdminNavigationPath(path).split('/').filter(Boolean)
  if (segments.length <= 1) return void 0

  return `/${segments.slice(0, -1).join('/')}`
}
