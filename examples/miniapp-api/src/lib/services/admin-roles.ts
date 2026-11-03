import { and, eq } from 'drizzle-orm'

import db from '@/db'
import { systemRoles, systemUserRoles, systemUsers } from '@/db/schema'
import { Status } from '@/lib/enums'
import { enforcerPromise } from '@/lib/services/casbin'

/** Read active role assignments when creating or refreshing a login session. */
export async function getCurrentAdminUserRoles(userId: string): Promise<string[] | null> {
  const [user] = await db.select({ status: systemUsers.status }).from(systemUsers).where(eq(systemUsers.id, userId)).limit(1)
  if (!user || user.status !== Status.ENABLED) return null

  const roles = await db
    .select({ id: systemRoles.id })
    .from(systemUserRoles)
    .innerJoin(systemRoles, eq(systemUserRoles.roleId, systemRoles.id))
    .where(and(eq(systemUserRoles.userId, userId), eq(systemRoles.status, Status.ENABLED)))

  return roles.map(({ id }) => id)
}

export function resolveEnabledRoleIds(directRoles: readonly string[], enabledRoleIds: ReadonlySet<string>, groupings: readonly (readonly string[])[]): string[] {
  const parentsByChild = new Map<string, string[]>()
  for (const [child, parent] of groupings) {
    if (!child || !parent) continue
    const parents = parentsByChild.get(child) ?? []
    parents.push(parent)
    parentsByChild.set(child, parents)
  }

  const direct = new Set(directRoles.filter((role) => enabledRoleIds.has(role)))
  const effective = new Set(direct)
  const queue = [...direct]
  while (queue.length > 0) {
    const role = queue.shift()!
    for (const parent of parentsByChild.get(role) ?? []) {
      // The built-in administrator role must be assigned explicitly.
      if (!enabledRoleIds.has(parent) || (parent === 'admin' && !direct.has('admin')) || effective.has(parent)) continue
      effective.add(parent)
      queue.push(parent)
    }
  }

  return [...effective]
}

export async function getEffectiveEnabledRoleIds(directRoles: readonly string[]): Promise<string[]> {
  if (directRoles.length === 0) return []
  const [roles, enforcer] = await Promise.all([db.select({ id: systemRoles.id }).from(systemRoles).where(eq(systemRoles.status, Status.ENABLED)), enforcerPromise])
  return resolveEnabledRoleIds(directRoles, new Set(roles.map(({ id }) => id)), await enforcer.getGroupingPolicy())
}
