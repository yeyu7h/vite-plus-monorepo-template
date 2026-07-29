import type { z } from 'zod'

import { eq, inArray } from 'drizzle-orm'

import db from '@/db'
import { systemMenuGroups, systemMenuRoles, systemMenus } from '@/db/schema'
import type { SystemMenuIcon } from '@/db/schema'
import { MenuType } from '@/lib/enums'
import { enforcerPromise } from '@/lib/services/casbin'

import type { menuMutationFieldsSchema } from './menus.schema'

export type MenuMutationInput = z.infer<typeof menuMutationFieldsSchema>
export type SystemMenuRow = typeof systemMenus.$inferSelect

export interface SystemMenuTreeNode extends SystemMenuRow {
  children: SystemMenuTreeNode[]
}

interface BackendMenuMetaDto {
  activePath?: string
  authority?: string[]
  contentMode?: 'default' | 'full'
  description?: string
  externalLink?: string
  hideInBreadcrumb?: boolean
  hideInMenu?: boolean
  hideInTab?: boolean
  icon?: SystemMenuIcon
  iframeSrc?: string
  ignoreAccess?: boolean
  keepAlive?: boolean
  menuGroup?: { id: string; label: string; order: number }
  menuVisibleWithForbidden?: boolean
  order?: number
  showActiveTabBorder?: boolean
  tabPath?: string
  title: string
}

export interface BackendMenuDto {
  children?: BackendMenuDto[]
  id: string
  meta: BackendMenuMetaDto
  path: string
}

export interface AdminAccessData {
  menus: BackendMenuDto[]
  permissionCodes: string[]
}

export class MenuConflictError extends Error {}

function sortMenuNodes(a: SystemMenuTreeNode, b: SystemMenuTreeNode) {
  return a.order - b.order || a.title.localeCompare(b.title) || a.id.localeCompare(b.id)
}

export async function getAllMenuNodes(): Promise<SystemMenuTreeNode[]> {
  const rows = await db.select().from(systemMenus).orderBy(systemMenus.order, systemMenus.title)
  const nodes = new Map<string, SystemMenuTreeNode>()
  for (const row of rows) {
    nodes.set(row.id, { ...row, children: [] })
  }

  const roots: SystemMenuTreeNode[] = []
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined
    if (parent) parent.children.push(node)
    else roots.push(node)
  }

  const sortRecursively = (items: SystemMenuTreeNode[]) => {
    items.sort(sortMenuNodes)
    for (const item of items) sortRecursively(item.children)
  }
  sortRecursively(roots)

  return roots
}

export async function getMenuNode(id: string) {
  const [row] = await db.select().from(systemMenus).where(eq(systemMenus.id, id)).limit(1)
  if (!row) return null
  const links = await db.select().from(systemMenuRoles).where(eq(systemMenuRoles.menuId, id))
  return { row, links }
}

export function flattenMenuTree(nodes: readonly SystemMenuTreeNode[]): SystemMenuTreeNode[] {
  return nodes.flatMap((node) => [node, ...flattenMenuTree(node.children)])
}

function isUrl(value: string | null | undefined) {
  if (!value) return false
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

async function validateMenu(input: MenuMutationInput, editingId?: string) {
  const roots = await getAllMenuNodes()
  const nodes = flattenMenuTree(roots)
  const current = editingId ? nodes.find((node) => node.id === editingId) : undefined
  const parent = input.parentId ? nodes.find((node) => node.id === input.parentId) : undefined
  const children = current?.children ?? []

  if (input.parentId && !parent) throw new MenuConflictError('父菜单不存在')
  if (input.groupId) {
    const [group] = await db.select({ id: systemMenuGroups.id }).from(systemMenuGroups).where(eq(systemMenuGroups.id, input.groupId)).limit(1)
    if (!group) throw new MenuConflictError('菜单分组不存在')
  }

  if (editingId && input.parentId === editingId) throw new MenuConflictError('菜单不能成为自己的下级')
  if (editingId && input.parentId) {
    const descendants = new Set(flattenMenuTree(current?.children ?? []).map((node) => node.id))
    if (descendants.has(input.parentId)) throw new MenuConflictError('移动菜单会形成循环层级')
  }

  if (input.parentId) {
    if (parent?.type !== MenuType.DIRECTORY && parent?.type !== MenuType.PAGE) throw new MenuConflictError('该父节点不允许新增下级')
    if (input.groupId) throw new MenuConflictError('下级菜单不能单独设置菜单分组')
  }

  if (input.type === MenuType.BUTTON) {
    if (!parent || parent.type !== MenuType.PAGE) throw new MenuConflictError('按钮权限只能作为本地页面的直接下级')
    if (children.length > 0) throw new MenuConflictError('有下级的菜单不能转换为按钮')
    if (!input.permissionCode?.match(/^[a-z][a-z0-9_-]*(?::[a-z0-9_-]+)+$/)) throw new MenuConflictError('权限码格式错误')
    if (!input.resource?.startsWith('/')) throw new MenuConflictError('API 资源必须以 / 开头')
    if (!input.action?.match(/^[A-Z|]+$/)) throw new MenuConflictError('HTTP 方法必须使用大写字母')
    return
  }

  if (input.type === MenuType.PAGE && input.permissionCode && !input.permissionCode.match(/^[a-z][a-z0-9_-]*(?::[a-z0-9_-]+)+$/)) {
    throw new MenuConflictError('权限码格式错误')
  }

  if (!input.path?.startsWith('/')) throw new MenuConflictError('菜单路径必须是绝对路径')
  if (parent?.path && input.path !== parent.path && !input.path.startsWith(`${parent.path}/`)) {
    throw new MenuConflictError('菜单路径必须以前级菜单路径为前缀')
  }

  if ((input.type === MenuType.EXTERNAL || input.type === MenuType.IFRAME) && children.length > 0) {
    throw new MenuConflictError('外链和 iframe 菜单不能拥有下级')
  }
  if (input.type === MenuType.DIRECTORY && children.some((child) => child.type === MenuType.BUTTON)) {
    throw new MenuConflictError('包含按钮权限的页面不能转换为目录')
  }
  if (input.type === MenuType.EXTERNAL && !isUrl(input.externalLink)) throw new MenuConflictError('外链地址格式错误')
  if (input.type === MenuType.IFRAME && !isUrl(input.iframeSrc)) throw new MenuConflictError('iframe 地址格式错误')
}

function normalizeMenuValues(input: MenuMutationInput) {
  const isButton = input.type === MenuType.BUTTON
  const isPage = input.type === MenuType.PAGE
  const isExternal = input.type === MenuType.EXTERNAL
  const isIframe = input.type === MenuType.IFRAME

  return {
    parentId: input.parentId ?? null,
    groupId: input.parentId || isButton ? null : (input.groupId ?? null),
    type: input.type,
    title: input.title.trim(),
    path: isButton ? null : (input.path?.trim() ?? null),
    icon: input.icon ?? null,
    order: input.order,
    activePath: isButton ? null : input.activePath?.trim() || null,
    contentMode: isButton ? null : (input.contentMode ?? null),
    description: input.description?.trim() || null,
    externalLink: isExternal ? (input.externalLink?.trim() ?? null) : null,
    hideInBreadcrumb: isButton ? false : input.hideInBreadcrumb,
    hideInMenu: isButton ? true : input.hideInMenu,
    hideInTab: isButton ? true : input.hideInTab,
    iframeSrc: isIframe ? (input.iframeSrc?.trim() ?? null) : null,
    ignoreAccess: isButton ? false : input.ignoreAccess,
    keepAlive: isButton ? false : input.keepAlive,
    menuVisibleWithForbidden: isButton ? false : input.menuVisibleWithForbidden,
    showActiveTabBorder: isButton ? false : input.showActiveTabBorder,
    tabPath: isButton ? null : input.tabPath?.trim() || null,
    permissionCode: isButton || isPage ? input.permissionCode?.trim() || null : null,
    resource: isButton ? (input.resource?.trim() ?? null) : null,
    action: isButton ? (input.action?.trim().toUpperCase() ?? null) : null,
  }
}

export async function createSystemMenu(input: MenuMutationInput, createdBy: string) {
  await validateMenu(input)
  const values = normalizeMenuValues(input)
  const [created] = await db
    .insert(systemMenus)
    .values({ ...values, createdBy })
    .returning()
  return { ...created, children: [] }
}

export async function updateSystemMenu(id: string, patch: Partial<MenuMutationInput>, updatedBy: string) {
  const existing = await getMenuNode(id)
  if (!existing) return null

  const merged = {
    ...existing.row,
    ...patch,
  } as MenuMutationInput

  await validateMenu(merged, id)
  const values = normalizeMenuValues(merged)
  const [updated] = await db
    .update(systemMenus)
    .set({ ...values, updatedBy })
    .where(eq(systemMenus.id, id))
    .returning()
  await synchronizeButtonPolicies(existing.row, updated, existing.links)
  return { ...updated, children: [] }
}

export async function deleteSystemMenu(id: string) {
  const existing = await getMenuNode(id)
  if (!existing) return null
  const child = await db.select({ id: systemMenus.id }).from(systemMenus).where(eq(systemMenus.parentId, id)).limit(1)
  if (child.length > 0) throw new MenuConflictError('菜单仍有下级，请先移动或删除下级')

  if (existing.row.type === MenuType.BUTTON) {
    const enforcer = await enforcerPromise
    for (const link of existing.links) {
      if (link.policyManaged && existing.row.resource && existing.row.action) await enforcer.removePolicy(link.roleId, existing.row.resource, existing.row.action)
    }
  }
  await db.delete(systemMenus).where(eq(systemMenus.id, id))
  return { id }
}

function resolveBackendPath(path: string, parentPath?: string) {
  if (!parentPath) return path
  const prefix = parentPath === '/' ? '/' : `${parentPath}/`
  return path.startsWith(prefix) ? path.slice(prefix.length) : path
}

function toBackendMenu(node: SystemMenuTreeNode, groups: Map<string, typeof systemMenuGroups.$inferSelect>, parentPath?: string): BackendMenuDto | null {
  if (node.type === MenuType.BUTTON || !node.path) return null
  const children = node.children.map((child) => toBackendMenu(child, groups, node.path ?? undefined)).filter((child): child is BackendMenuDto => child !== null)
  const group = !node.parentId && node.groupId ? groups.get(node.groupId) : undefined

  return {
    id: node.id,
    path: resolveBackendPath(node.path, parentPath),
    meta: {
      title: node.title,
      authority: [],
      ...(node.activePath ? { activePath: node.activePath } : {}),
      ...(node.contentMode ? { contentMode: node.contentMode } : {}),
      ...(node.description ? { description: node.description } : {}),
      ...(node.externalLink ? { externalLink: node.externalLink } : {}),
      ...(node.hideInBreadcrumb ? { hideInBreadcrumb: true } : {}),
      ...(node.hideInMenu ? { hideInMenu: true } : {}),
      ...(node.hideInTab ? { hideInTab: true } : {}),
      ...(node.icon ? { icon: node.icon } : {}),
      ...(node.iframeSrc ? { iframeSrc: node.iframeSrc } : {}),
      ...(node.ignoreAccess ? { ignoreAccess: true } : {}),
      ...(node.keepAlive ? { keepAlive: true } : {}),
      ...(group ? { menuGroup: { id: group.id, label: group.name, order: group.order } } : {}),
      ...(node.menuVisibleWithForbidden ? { menuVisibleWithForbidden: true } : {}),
      order: node.order,
      ...(node.showActiveTabBorder ? { showActiveTabBorder: true } : {}),
      ...(node.tabPath ? { tabPath: node.tabPath } : {}),
    },
    ...(children.length > 0 ? { children } : {}),
  }
}

export async function getAdminAccessData(roles: string[]): Promise<AdminAccessData> {
  const [tree, groups] = await Promise.all([getAllMenuNodes(), db.select().from(systemMenuGroups)])
  const allNodes = flattenMenuTree(tree)
  const isAdmin = roles.includes('admin')
  const allowedIds = isAdmin ? new Set(allNodes.map((node) => node.id)) : await getAllowedMenuIds(roles, allNodes)
  const groupMap = new Map(groups.map((group) => [group.id, group]))
  const visibleTree = filterMenuTree(tree, allowedIds)
  const menus = visibleTree.map((node) => toBackendMenu(node, groupMap)).filter((menu): menu is BackendMenuDto => menu !== null)
  const permissionCodes = flattenMenuTree(visibleTree)
    .filter((node) => node.permissionCode)
    .map((node) => node.permissionCode!)

  return { menus, permissionCodes: [...new Set(permissionCodes)].sort() }
}

async function synchronizeButtonPolicies(oldRow: SystemMenuRow, nextRow: SystemMenuRow, links: Array<typeof systemMenuRoles.$inferSelect>) {
  const oldButton = oldRow.type === MenuType.BUTTON && oldRow.resource && oldRow.action
  const nextButton = nextRow.type === MenuType.BUTTON && nextRow.resource && nextRow.action
  if (!oldButton && !nextButton) return

  const enforcer = await enforcerPromise
  for (const link of links) {
    if (oldButton && link.policyManaged) await enforcer.removePolicy(link.roleId, oldRow.resource!, oldRow.action!)
    if (!nextButton) {
      if (link.policyManaged) await db.update(systemMenuRoles).set({ policyManaged: false }).where(eq(systemMenuRoles.menuId, nextRow.id))
      continue
    }
    const exists = await enforcer.hasPolicy(link.roleId, nextRow.resource!, nextRow.action!)
    if (!exists) await enforcer.addPolicy(link.roleId, nextRow.resource!, nextRow.action!)
    await db.update(systemMenuRoles).set({ policyManaged: !exists }).where(eq(systemMenuRoles.menuId, nextRow.id))
  }
}

async function getAllowedMenuIds(roles: string[], nodes: readonly SystemMenuTreeNode[]) {
  if (roles.length === 0) return new Set<string>()
  const enforcer = await enforcerPromise
  const groupingPolicies = await enforcer.getGroupingPolicy()
  const parentRoles = new Map<string, string[]>()
  for (const [child, parent] of groupingPolicies) parentRoles.set(child, [...(parentRoles.get(child) ?? []), parent])
  const effectiveRoles = new Set(roles)
  const queue = [...roles]
  while (queue.length > 0) {
    const roleId = queue.shift()!
    for (const parent of parentRoles.get(roleId) ?? []) {
      if (!effectiveRoles.has(parent)) {
        effectiveRoles.add(parent)
        queue.push(parent)
      }
    }
  }
  const links = await db
    .select()
    .from(systemMenuRoles)
    .where(inArray(systemMenuRoles.roleId, [...effectiveRoles]))
  const allowedIds = new Set(links.map((link) => link.menuId))
  const byId = new Map(nodes.map((node) => [node.id, node]))
  for (const id of allowedIds) {
    let parentId = byId.get(id)?.parentId
    while (parentId) {
      allowedIds.add(parentId)
      parentId = byId.get(parentId)?.parentId
    }
  }
  return allowedIds
}

function filterMenuTree(nodes: readonly SystemMenuTreeNode[], allowedIds: ReadonlySet<string>): SystemMenuTreeNode[] {
  return nodes.flatMap((node) => {
    if (!allowedIds.has(node.id)) return []
    return [{ ...node, children: filterMenuTree(node.children, allowedIds) }]
  })
}
