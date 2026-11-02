import db from '@/db'
import { systemMenuRoles, systemMenus } from '@/db/schema'
import { enforcerPromise } from '@/lib/services/casbin'
import { buildAdminAccessPayload } from './access.payload'
import type { AdminAccessMenuRecord, AdminAccessPayload } from './access.payload'

/** Compatibility for access tokens issued before Redis-backed sessions. */
export async function resolveEffectiveAdminRoles(roles: readonly string[]): Promise<string[]> {
  const enforcer = await enforcerPromise
  const inherited = await Promise.all(roles.map((role) => enforcer.getImplicitRolesForUser(role)))
  return [...new Set([...roles, ...inherited.flat().filter((role) => role !== 'admin' || roles.includes('admin'))])]
}

export async function getAdminAccessByRoles(roles: readonly string[]): Promise<AdminAccessPayload> {
  return buildAdminAccessPayload(await loadAdminAccessMenuRows(), roles)
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
