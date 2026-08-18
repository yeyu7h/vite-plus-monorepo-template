import type { systemMenus } from '@/db/schema'
import type { MenuTreeNode } from './menus.schema'

import { and, eq, inArray, ne } from 'drizzle-orm'

import db from '@/db'
import { systemMenuRoles, systemMenus as menusTable } from '@/db/schema'

type MenuRow = typeof systemMenus.$inferSelect
type MenuWithRoles = MenuRow & { roleIds: string[] }
type MenuValidationInput = Pick<MenuRow, 'id' | 'path' | 'type'> &
  Partial<
    Pick<
      MenuRow,
      | 'activePath'
      | 'externalLink'
      | 'hideInBreadcrumb'
      | 'hideInMenu'
      | 'hideInTab'
      | 'icon'
      | 'iframeSrc'
      | 'ignoreAccess'
      | 'keepAlive'
      | 'menuVisibleWithForbidden'
      | 'showActiveTabBorder'
      | 'tabPath'
    >
  > & {
    accessScope: 'public' | 'restricted'
    parentId?: string | null
    permissionCode?: string | null
  }

export class MenuValidationError extends Error {
  readonly kind: 'conflict' | 'invalid'

  constructor(message: string, kind: 'conflict' | 'invalid' = 'invalid') {
    super(message)
    this.kind = kind
  }
}

export function buildMenuTree(rows: readonly MenuWithRoles[]): MenuTreeNode[] {
  const children = new Map<string | null, MenuWithRoles[]>()
  for (const row of rows) {
    const siblings = children.get(row.parentId ?? null) ?? []
    siblings.push(row)
    children.set(row.parentId ?? null, siblings)
  }
  for (const siblings of children.values()) siblings.sort(compareMenus)

  const build = (row: MenuWithRoles, visiting: ReadonlySet<string>): MenuTreeNode => {
    const next = new Set(visiting).add(row.id)
    const nested = (children.get(row.id) ?? []).filter((item) => !next.has(item.id)).map((item) => build(item, next))
    return {
      ...row,
      accessScope: row.roleIds.length > 0 ? 'restricted' : 'public',
      ...(nested.length > 0 ? { children: nested } : {}),
    }
  }

  const ids = new Set(rows.map(({ id }) => id))
  return rows
    .filter((row) => !row.parentId || !ids.has(row.parentId))
    .sort(compareMenus)
    .map((row) => build(row, new Set()))
}

export async function loadMenuRows(): Promise<MenuWithRoles[]> {
  const [rows, roleLinks] = await Promise.all([
    db.select().from(menusTable).orderBy(menusTable.order),
    db.select({ menuId: systemMenuRoles.menuId, roleId: systemMenuRoles.roleId }).from(systemMenuRoles),
  ])
  const roleIdsByMenu = groupRoleIdsByMenu(roleLinks)
  return rows.map((row) => ({ ...row, roleIds: roleIdsByMenu.get(row.id) ?? [] }))
}

export async function loadMenuNode(id: string): Promise<MenuTreeNode | null> {
  const [row] = await db.select().from(menusTable).where(eq(menusTable.id, id)).limit(1)
  if (!row) return null
  const roleLinks = await db.select({ roleId: systemMenuRoles.roleId }).from(systemMenuRoles).where(eq(systemMenuRoles.menuId, id))
  const roleIds = roleLinks.map(({ roleId }) => roleId).sort((left, right) => left.localeCompare(right))
  return { ...row, roleIds, accessScope: roleIds.length > 0 ? 'restricted' : 'public' }
}

export function collectMenuSubtreeIds(rows: readonly Pick<MenuRow, 'id' | 'parentId'>[], rootId: string): string[] {
  const childIds = new Map<string, string[]>()
  for (const row of rows) {
    if (!row.parentId) continue
    const ids = childIds.get(row.parentId) ?? []
    ids.push(row.id)
    childIds.set(row.parentId, ids)
  }
  const result: string[] = []
  const pending = [rootId]
  const visited = new Set<string>()
  while (pending.length > 0) {
    const id = pending.pop()!
    if (visited.has(id)) continue
    visited.add(id)
    result.push(id)
    pending.push(...(childIds.get(id) ?? []))
  }
  return result
}

export async function validateMenuWrite(menu: MenuValidationInput, currentId?: string): Promise<void> {
  const rows = await loadMenuRows()
  const current = currentId ? rows.find(({ id }) => id === currentId) : undefined

  if (currentId && !current) throw new MenuValidationError('菜单节点不存在')
  if (!currentId && rows.some(({ id }) => id === menu.id)) throw new MenuValidationError('菜单 ID 已存在', 'conflict')

  const parent = menu.parentId ? rows.find(({ id }) => id === menu.parentId) : undefined
  if (menu.parentId && !parent) throw new MenuValidationError('父菜单节点不存在')
  if (parent?.type === 'button') throw new MenuValidationError('按钮节点不能拥有子节点')
  if (menu.parentId === menu.id) throw new MenuValidationError('菜单不能将自身设置为父节点')

  if (menu.type === 'group') {
    if (menu.parentId) throw new MenuValidationError('菜单分组只能位于顶层')
    if (menu.path) throw new MenuValidationError('菜单分组不能设置路径')
    if (menu.accessScope !== 'public') throw new MenuValidationError('菜单分组不参与角色授权')
    if (menu.permissionCode) throw new MenuValidationError('菜单分组不能设置权限码')
    if (hasGroupRouteConfig(menu)) throw new MenuValidationError('菜单分组不能设置路由、图标或显示属性')
  } else {
    if (!menu.path) throw new MenuValidationError('非分组节点必须设置路径')

    if (parent?.type === 'group') {
      if (menu.type === 'button') throw new MenuValidationError('按钮节点不能直接位于菜单分组下')
      if (!menu.path.startsWith('/')) throw new MenuValidationError('菜单分组下的根菜单路径必须以 / 开头')
    } else if (menu.parentId) {
      if (menu.path.startsWith('/')) throw new MenuValidationError('子节点路径必须使用相对路径')
    } else if (!menu.path.startsWith('/')) {
      throw new MenuValidationError('根菜单路径必须以 / 开头')
    }
  }

  if (menu.type !== 'group' && parent?.type === 'group' && parent.parentId) {
    throw new MenuValidationError('菜单分组只能位于顶层')
  }

  const duplicatePath = menu.path ? rows.find((row) => row.id !== currentId && (row.parentId ?? null) === (menu.parentId ?? null) && row.path === menu.path) : undefined
  if (duplicatePath) throw new MenuValidationError(`同级路径 ${menu.path} 已被菜单 ${duplicatePath.id} 使用`, 'conflict')

  if (menu.type === 'button') {
    if (!menu.permissionCode) throw new MenuValidationError('按钮节点必须设置权限码')
    const duplicatePermission = rows.find((row) => row.id !== currentId && row.permissionCode === menu.permissionCode)
    if (duplicatePermission) throw new MenuValidationError(`权限码 ${menu.permissionCode} 已被按钮 ${duplicatePermission.id} 使用`, 'conflict')
    if (currentId && rows.some(({ parentId }) => parentId === currentId)) throw new MenuValidationError('存在子节点的菜单不能改为按钮')
  } else if (menu.permissionCode) {
    throw new MenuValidationError('只有按钮节点可以设置权限码')
  }

  if (current && current.type !== menu.type && (current.type === 'group' || menu.type === 'group') && rows.some(({ parentId }) => parentId === currentId)) {
    throw new MenuValidationError('存在子节点时不能在菜单分组和普通菜单类型之间切换')
  }

  const rowMap = new Map(rows.map((row) => [row.id, row]))
  let ancestorId = menu.parentId
  const visited = new Set<string>([menu.id])
  while (ancestorId) {
    if (visited.has(ancestorId)) throw new MenuValidationError('菜单父子关系不能形成循环')
    visited.add(ancestorId)
    const ancestor = rowMap.get(ancestorId)
    if (!ancestor) break
    if (menu.accessScope === 'public' && ancestor.roleIds.length > 0) throw new MenuValidationError('公共菜单不能位于受限菜单之下')
    ancestorId = ancestor.parentId
  }

  if (menu.accessScope === 'restricted' && currentId) {
    const descendantIds = new Set(collectMenuSubtreeIds(rows, currentId).slice(1))
    const publicDescendant = rows.find((row) => descendantIds.has(row.id) && row.roleIds.length === 0)
    if (publicDescendant) throw new MenuValidationError(`请先将公共后代 ${publicDescendant.title} 调整为受限菜单`)
  }
}

export async function replaceMenuScope(menuId: string, accessScope: 'public' | 'restricted') {
  if (accessScope === 'public') {
    await db.delete(systemMenuRoles).where(eq(systemMenuRoles.menuId, menuId))
    return
  }
  await db.insert(systemMenuRoles).values({ menuId, roleId: 'admin' }).onConflictDoNothing()
}

export async function ensureAdminMenuLinks(menuIds: readonly string[]) {
  if (menuIds.length === 0) return
  await db
    .insert(systemMenuRoles)
    .values(menuIds.map((menuId) => ({ menuId, roleId: 'admin' })))
    .onConflictDoNothing()
}

export async function replaceRoleMenuLinks(roleId: string, menuIds: readonly string[]) {
  await db.transaction(async (tx) => {
    await tx.delete(systemMenuRoles).where(and(eq(systemMenuRoles.roleId, roleId), ne(systemMenuRoles.roleId, 'admin')))
    if (menuIds.length > 0)
      await tx
        .insert(systemMenuRoles)
        .values(menuIds.map((menuId) => ({ menuId, roleId })))
        .onConflictDoNothing()
  })
}

export async function deleteMenuSubtree(rootId: string): Promise<number | null> {
  const rows = await db.select({ id: menusTable.id, parentId: menusTable.parentId, type: menusTable.type }).from(menusTable)
  const root = rows.find(({ id }) => id === rootId)
  if (!root) return null
  const ids = collectMenuSubtreeIds(rows, rootId)
  if (root.type === 'group' && ids.length > 1) throw new MenuValidationError(`菜单分组仍包含 ${ids.length - 1} 个节点，请先移动或删除这些菜单`, 'conflict')
  await db.transaction(async (tx) => {
    await tx.delete(systemMenuRoles).where(inArray(systemMenuRoles.menuId, ids))
    await tx.delete(menusTable).where(eq(menusTable.id, rootId))
  })
  return ids.length
}

function compareMenus(left: Pick<MenuRow, 'id' | 'order' | 'title'>, right: Pick<MenuRow, 'id' | 'order' | 'title'>) {
  return left.order - right.order || left.title.localeCompare(right.title) || left.id.localeCompare(right.id)
}

function groupRoleIdsByMenu(roleLinks: readonly { menuId: string; roleId: string }[]): Map<string, string[]> {
  const roleIdsByMenu = new Map<string, string[]>()
  for (const { menuId, roleId } of roleLinks) {
    const roleIds = roleIdsByMenu.get(menuId) ?? []
    roleIds.push(roleId)
    roleIdsByMenu.set(menuId, roleIds)
  }
  for (const roleIds of roleIdsByMenu.values()) roleIds.sort((left, right) => left.localeCompare(right))
  return roleIdsByMenu
}

function hasGroupRouteConfig(menu: MenuValidationInput) {
  return Boolean(
    menu.activePath ||
    menu.externalLink ||
    menu.hideInBreadcrumb ||
    menu.hideInMenu ||
    menu.hideInTab ||
    menu.icon ||
    menu.iframeSrc ||
    menu.ignoreAccess ||
    menu.keepAlive ||
    menu.menuVisibleWithForbidden ||
    menu.showActiveTabBorder ||
    menu.tabPath,
  )
}
