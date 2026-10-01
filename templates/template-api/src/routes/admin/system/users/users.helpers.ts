import type { z } from 'zod'

import type { systemUsersQueryResultSchema } from './users.schema'

import type { systemUsersCreateSchema } from './users.schema'

import type { RefineQueryParams } from '@/lib/core/refine-query'
import { hash } from '@node-rs/argon2'

import { eq, inArray } from 'drizzle-orm'
import db from '@/db'
import { systemRoles, systemUserRoles, systemUsers } from '@/db/schema'
import { executeRefineQuery } from '@/lib/core/refine-query'

type CreateUserInput = z.infer<typeof systemUsersCreateSchema>

/**
 * Query user list (including role info)
 * 查询用户列表（包含角色信息）
 */
export async function listUsers(queryParams: RefineQueryParams) {
  const requestedSorters = (queryParams.sorters ?? []).filter(({ field }: { field: string }) => field !== 'builtIn')
  const result = await executeRefineQuery<typeof systemUsers.$inferSelect>({
    table: systemUsers,
    queryParams: {
      ...queryParams,
      sorters: [{ field: 'builtIn', order: 'desc' }, ...requestedSorters],
    },
  })

  if (result[0]) return result
  const userIds = result[1].data.map(({ id }) => id)
  const roleRows = userIds.length
    ? await db
        .select({ userId: systemUserRoles.userId, id: systemRoles.id, name: systemRoles.name })
        .from(systemUserRoles)
        .innerJoin(systemRoles, eq(systemUserRoles.roleId, systemRoles.id))
        .where(inArray(systemUserRoles.userId, userIds))
    : []
  const rolesByUser = new Map<string, Array<{ id: string; name: string }>>()
  for (const role of roleRows) {
    const roles = rolesByUser.get(role.userId) ?? []
    roles.push({ id: role.id, name: role.name })
    rolesByUser.set(role.userId, roles)
  }

  return [
    null,
    {
      ...result[1],
      data: result[1].data.map((user) => ({ ...user, roles: rolesByUser.get(user.id) ?? [] })) as z.infer<typeof systemUsersQueryResultSchema>[],
    },
  ] as const
}

/**
 * Create user
 * 创建用户
 */
export async function createUser(data: CreateUserInput, createdBy: string) {
  const { roleIds, ...userData } = data
  const roles = await getAssignableRoles(roleIds)
  const hashedPassword = await hash(userData.password)

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(systemUsers)
      .values({ ...userData, password: hashedPassword, createdBy, updatedBy: createdBy })
      .returning()
    if (roleIds.length > 0) await tx.insert(systemUserRoles).values([...new Set(roleIds)].map((roleId) => ({ userId: created.id, roleId })))
    return { ...created, roles: roles.map(({ id, name }) => ({ id, name })) }
  })
}

/**
 * Validate roles exist
 * @returns null if all exist, otherwise returns list of non-existent role IDs / null 表示全部存在，否则返回不存在的角色 ID 列表
 * 验证角色是否存在
 */
export async function validateRolesExist(roleIds: string[]): Promise<string[] | null> {
  if (roleIds.length === 0) return null

  const existingRoles = await db.select({ id: systemRoles.id }).from(systemRoles).where(inArray(systemRoles.id, roleIds))

  if (existingRoles.length === roleIds.length) return null

  const foundRoles = new Set(existingRoles.map((role) => role.id))
  return roleIds.filter((roleId) => !foundRoles.has(roleId))
}

export async function getAssignableRoles(roleIds: string[]) {
  if (roleIds.length === 0) return []
  const uniqueIds = [...new Set(roleIds)]
  const roles = await db.select({ id: systemRoles.id, name: systemRoles.name, status: systemRoles.status }).from(systemRoles).where(inArray(systemRoles.id, uniqueIds))
  const found = new Set(roles.map(({ id }) => id))
  const missing = uniqueIds.filter((id) => !found.has(id))
  if (missing.length > 0) throw new UserRoleValidationError(`角色不存在: ${missing.join(', ')}`, 'not_found')
  const disabled = roles.filter(({ status }) => status !== 'ENABLED').map(({ id }) => id)
  if (disabled.length > 0) throw new UserRoleValidationError(`禁用角色不能分配: ${disabled.join(', ')}`, 'disabled')
  return roles
}

export class UserRoleValidationError extends Error {
  readonly reason: 'disabled' | 'not_found'

  constructor(message: string, reason: 'disabled' | 'not_found') {
    super(message)
    this.reason = reason
  }
}
