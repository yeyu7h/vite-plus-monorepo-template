import type { AdminMenuIcon, AdminMenuType } from '@/db/schema'

import { Status } from '@/lib/enums'
import { enforcerPromise } from '@/lib/services/casbin'
import db from '@/db'
import { systemMenuRoles, systemMenus } from '@/db/schema'

const ADMIN_ROLE_ID = 'admin'
const ADMIN_PERMISSION_CODE = '*:*:*'

export interface AdminAccessMenuMeta {
  activePath?: string
  authority?: string[]
  contentMode?: 'default' | 'full'
  description?: string
  externalLink?: string
  hideInBreadcrumb?: boolean
  hideInMenu?: boolean
  hideInTab?: boolean
  icon?: AdminMenuIcon
  iframeSrc?: string
  ignoreAccess?: boolean
  keepAlive?: boolean
  group?: { id: string; label: string; order: number } | string
  menuVisibleWithForbidden?: boolean
  order?: number
  showActiveTabBorder?: boolean
  tabPath?: string
  title: string
}

export interface AdminAccessMenu {
  children?: AdminAccessMenu[]
  id: string
  meta: AdminAccessMenuMeta
  path: string
  type: Exclude<AdminMenuType, 'button' | 'group'>
}

export interface AdminAccessPayload {
  menus: AdminAccessMenu[]
  permissionCodes: string[]
}

/** Access helper input kept independent from Drizzle query results for unit testing. */
export interface AdminAccessMenuRecord {
  activePath?: string | null
  contentMode?: 'default' | 'full' | null
  description?: string | null
  externalLink?: string | null
  hideInBreadcrumb?: boolean
  hideInMenu?: boolean
  hideInTab?: boolean
  icon?: AdminMenuIcon | null
  iframeSrc?: string | null
  id: string
  ignoreAccess?: boolean
  keepAlive?: boolean
  menuVisibleWithForbidden?: boolean
  order?: number
  parentId?: string | null
  path: string | null
  permissionCode?: string | null
  roleIds: string[]
  showActiveTabBorder?: boolean
  status?: string
  tabPath?: string | null
  title: string
  type: AdminMenuType
}

/**
 * 根据启用菜单构建当前用户的访问载荷。
 *
 * 没有关联角色的菜单是公共菜单；有关联角色的菜单按 Casbin 的隐式角色集合判断。
 * `menuVisibleWithForbidden` 允许菜单在无权限时仍进入返回树，前端会替换为 403 页面。
 */
export function buildAdminAccessPayload(rows: readonly AdminAccessMenuRecord[], effectiveRoles: readonly string[]): AdminAccessPayload {
  const childrenById = new Map<string, string[]>()
  for (const row of rows) {
    if (!row.parentId) continue
    const childIds = childrenById.get(row.parentId) ?? []
    childIds.push(row.id)
    childrenById.set(row.parentId, childIds)
  }
  const hiddenIds = new Set<string>()
  const pendingHiddenIds = rows.filter((row) => row.status && row.status !== Status.ENABLED).map(({ id }) => id)
  while (pendingHiddenIds.length > 0) {
    const id = pendingHiddenIds.pop()!
    if (hiddenIds.has(id)) continue
    hiddenIds.add(id)
    pendingHiddenIds.push(...(childrenById.get(id) ?? []))
  }

  const enabledRows = rows.filter((row) => !hiddenIds.has(row.id))
  const rowsById = new Map(enabledRows.map((row) => [row.id, row]))
  const effectiveRoleSet = new Set(effectiveRoles)
  const isAdmin = effectiveRoleSet.has(ADMIN_ROLE_ID)
  const selectedIds = new Set<string>()
  const permissionCodes = new Set<string>()

  for (const row of enabledRows) {
    if (row.type === 'group') continue
    const hasRoleRestriction = row.roleIds.length > 0
    const isAllowed = !hasRoleRestriction || row.roleIds.some((roleId) => effectiveRoleSet.has(roleId))

    if (row.type === 'button') {
      if (isAllowed && row.permissionCode) permissionCodes.add(row.permissionCode)
      if (!isAllowed) continue
    } else if (!isAllowed && !row.menuVisibleWithForbidden) {
      continue
    }

    selectedIds.add(row.id)
  }

  // A visible child must always have its directory ancestors so the client can mount a complete route tree.
  for (const row of enabledRows) {
    if (!selectedIds.has(row.id)) continue

    const visited = new Set<string>([row.id])
    let parentId = row.parentId
    while (parentId && !visited.has(parentId)) {
      visited.add(parentId)
      const parent = rowsById.get(parentId)
      if (!parent) break

      selectedIds.add(parent.id)
      parentId = parent.parentId
    }
  }

  const childrenByParent = new Map<string | null, AdminAccessMenuRecord[]>()
  for (const row of enabledRows) {
    if (!selectedIds.has(row.id) || row.type === 'button' || row.type === 'group') continue

    const parent = row.parentId ? rowsById.get(row.parentId) : undefined
    const routeParentId = parent?.type === 'group' ? null : (row.parentId ?? null)
    const siblings = childrenByParent.get(routeParentId) ?? []
    siblings.push(row)
    childrenByParent.set(routeParentId, siblings)
  }

  for (const siblings of childrenByParent.values()) {
    siblings.sort(compareMenuRows)
  }

  const buildNode = (row: AdminAccessMenuRecord, visiting = new Set<string>()): AdminAccessMenu => {
    if (visiting.has(row.id)) {
      return toAccessMenu(row)
    }

    const nextVisiting = new Set(visiting).add(row.id)
    const children = (childrenByParent.get(row.id) ?? []).filter((child) => !nextVisiting.has(child.id)).map((child) => buildNode(child, nextVisiting))
    const node = toAccessMenu(row)

    if (children.length > 0) node.children = children
    return node
  }

  const rootRows = enabledRows
    .filter((row) => row.type !== 'button' && row.type !== 'group' && selectedIds.has(row.id) && (!row.parentId || rowsById.get(row.parentId)?.type === 'group' || !selectedIds.has(row.parentId)))
    .sort(compareMenuRows)
  const menus = rootRows.map((row) => buildNode(row))

  return {
    menus,
    permissionCodes: isAdmin ? [ADMIN_PERMISSION_CODE] : [...permissionCodes].sort(),
  }

  function toAccessMenu(row: AdminAccessMenuRecord): AdminAccessMenu {
    const parent = row.parentId ? rowsById.get(row.parentId) : undefined
    const meta: AdminAccessMenuMeta = {
      ...(row.activePath ? { activePath: row.activePath } : {}),
      ...(row.roleIds.length > 0 ? { authority: [...row.roleIds].sort() } : {}),
      ...(row.contentMode ? { contentMode: row.contentMode } : {}),
      ...(row.description ? { description: row.description } : {}),
      ...(row.externalLink ? { externalLink: row.externalLink } : {}),
      ...(row.hideInBreadcrumb ? { hideInBreadcrumb: true } : {}),
      ...(row.hideInMenu ? { hideInMenu: true } : {}),
      ...(row.hideInTab ? { hideInTab: true } : {}),
      ...(row.icon ? { icon: row.icon } : {}),
      ...(row.iframeSrc ? { iframeSrc: row.iframeSrc } : {}),
      ...(row.ignoreAccess ? { ignoreAccess: true } : {}),
      ...(row.keepAlive ? { keepAlive: true } : {}),
      ...(parent?.type === 'group'
        ? {
            group: {
              id: parent.id,
              label: parent.title,
              order: parent.order ?? 0,
            },
          }
        : {}),
      ...(row.menuVisibleWithForbidden ? { menuVisibleWithForbidden: true } : {}),
      ...(row.order !== undefined ? { order: row.order } : {}),
      ...(row.showActiveTabBorder ? { showActiveTabBorder: true } : {}),
      ...(row.tabPath ? { tabPath: row.tabPath } : {}),
      title: row.title,
    }

    return {
      id: row.id,
      meta,
      path: row.path!,
      type: row.type === 'directory' ? 'directory' : 'menu',
    }
  }
}

/** Resolve direct user roles plus all inherited parent roles from Casbin. */
export async function resolveEffectiveAdminRoles(roles: readonly string[]): Promise<string[]> {
  const roleSet = new Set(roles)
  const enforcer = await enforcerPromise
  const inheritedRoles = await Promise.all(roles.map((role) => enforcer.getImplicitRolesForUser(role)))

  for (const inherited of inheritedRoles) {
    for (const role of inherited) roleSet.add(role)
  }

  return [...roleSet]
}

export async function getAdminAccessByRoles(roles: readonly string[]): Promise<AdminAccessPayload> {
  const [rows, effectiveRoles] = await Promise.all([loadAdminAccessMenuRows(), resolveEffectiveAdminRoles(roles)])
  return buildAdminAccessPayload(rows, effectiveRoles)
}

async function loadAdminAccessMenuRows(): Promise<AdminAccessMenuRecord[]> {
  const [rows, roleLinks] = await Promise.all([
    db.select().from(systemMenus).orderBy(systemMenus.order),
    db.select({ menuId: systemMenuRoles.menuId, roleId: systemMenuRoles.roleId }).from(systemMenuRoles),
  ])
  const roleIdsByMenu = new Map<string, string[]>()
  for (const { menuId, roleId } of roleLinks) {
    const roleIds = roleIdsByMenu.get(menuId) ?? []
    roleIds.push(roleId)
    roleIdsByMenu.set(menuId, roleIds)
  }

  return rows.map((row) => ({ ...row, roleIds: roleIdsByMenu.get(row.id) ?? [] }))
}

function compareMenuRows(left: AdminAccessMenuRecord, right: AdminAccessMenuRecord) {
  return (left.order ?? 0) - (right.order ?? 0) || left.title.localeCompare(right.title) || left.id.localeCompare(right.id)
}
