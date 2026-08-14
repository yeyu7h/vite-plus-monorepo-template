import type { SystemUsersRouteHandlerType } from './users.types'

import { eq } from 'drizzle-orm'

import db from '@/db'
import { systemUserRoles, systemUsers } from '@/db/schema'
import { RefineQueryParamsSchema } from '@/lib/core/refine-query'
import { HttpStatusCodes } from '@monorepo/server-core'
import { HttpStatusPhrases } from '@monorepo/server-core'
import { omit, Resp } from '@/utils'

import { createUser, getAssignableRoles, listUsers, UserRoleValidationError } from './users.helpers'

export const list: SystemUsersRouteHandlerType<'list'> = async (c) => {
  const query = c.req.query()

  const parseResult = RefineQueryParamsSchema.safeParse(query)
  if (!parseResult.success) {
    return c.json(Resp.fail(parseResult.error), HttpStatusCodes.UNPROCESSABLE_ENTITY)
  }

  const [error, result] = await listUsers(parseResult.data)
  if (error) {
    return c.json(Resp.fail(error.message), HttpStatusCodes.INTERNAL_SERVER_ERROR)
  }

  const safeData = result.data.map(({ password: _password, ...user }) => user)
  c.header('x-total-count', result.total.toString())

  return c.json(Resp.ok(safeData), HttpStatusCodes.OK)
}

export const create: SystemUsersRouteHandlerType<'create'> = async (c) => {
  const body = c.req.valid('json')
  const { sub } = c.get('jwtPayload')

  let created
  try {
    created = await createUser(body, sub)
  } catch (error) {
    if (error instanceof UserRoleValidationError) {
      const status = error.reason === 'not_found' ? HttpStatusCodes.NOT_FOUND : HttpStatusCodes.BAD_REQUEST
      return c.json(Resp.fail(error.message), status)
    }
    throw error
  }
  const userWithoutPassword = omit(created, ['password'])

  return c.json(Resp.ok(userWithoutPassword), HttpStatusCodes.CREATED)
}

export const get: SystemUsersRouteHandlerType<'get'> = async (c) => {
  const { id } = c.req.valid('param')

  const user = await db.query.systemUsers.findFirst({
    where: { id },
    with: {
      roles: {
        columns: { id: true, name: true },
      },
    },
  })

  if (!user) {
    return c.json(Resp.fail(HttpStatusPhrases.NOT_FOUND), HttpStatusCodes.NOT_FOUND)
  }

  const { roles } = user
  const userWithoutPassword = omit(user, ['password', 'roles'])

  return c.json(Resp.ok({ ...userWithoutPassword, roles }), HttpStatusCodes.OK)
}

export const update: SystemUsersRouteHandlerType<'update'> = async (c) => {
  const { id } = c.req.valid('param')
  const body = c.req.valid('json')
  const { sub } = c.get('jwtPayload')

  // Check if built-in user / 检查是否为内置用户
  const user = await db.query.systemUsers.findFirst({ where: { id }, with: { roles: { columns: { id: true, name: true } } } })

  if (!user) {
    return c.json(Resp.fail(HttpStatusPhrases.NOT_FOUND), HttpStatusCodes.NOT_FOUND)
  }

  // Built-in users cannot have their status modified / 内置用户不允许修改状态
  if (user.builtIn && body.status === 'DISABLED') {
    return c.json(Resp.fail('内置用户不允许禁用'), HttpStatusCodes.FORBIDDEN)
  }
  if (user.builtIn && body.username !== undefined && body.username !== user.username) return c.json(Resp.fail('内置用户不允许修改用户名'), HttpStatusCodes.FORBIDDEN)
  if (user.builtIn && body.roleIds !== undefined) return c.json(Resp.fail('内置用户不允许修改角色'), HttpStatusCodes.FORBIDDEN)

  const { roleIds: requestedRoleIds, ...updateData } = body
  const roleIds = requestedRoleIds as string[] | undefined
  let roles = user.roles
  try {
    if (roleIds !== undefined) roles = (await getAssignableRoles(roleIds)).map(({ id: roleId, name }) => ({ id: roleId, name }))
  } catch (error) {
    if (error instanceof UserRoleValidationError) {
      const status = error.reason === 'not_found' ? HttpStatusCodes.NOT_FOUND : HttpStatusCodes.BAD_REQUEST
      return c.json(Resp.fail(error.message), status)
    }
    throw error
  }

  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(systemUsers)
      .set({ ...updateData, updatedBy: sub })
      .where(eq(systemUsers.id, id))
      .returning()
    if (roleIds !== undefined) {
      await tx.delete(systemUserRoles).where(eq(systemUserRoles.userId, id))
      if (roleIds.length > 0) await tx.insert(systemUserRoles).values([...new Set(roleIds)].map((roleId) => ({ userId: id, roleId })))
    }
    return row
  })

  if (!updated) {
    return c.json(Resp.fail(HttpStatusPhrases.NOT_FOUND), HttpStatusCodes.NOT_FOUND)
  }

  const userWithoutPassword = { ...omit(updated, ['password']), roles }

  return c.json(Resp.ok(userWithoutPassword), HttpStatusCodes.OK)
}

export const remove: SystemUsersRouteHandlerType<'remove'> = async (c) => {
  const { id } = c.req.valid('param')
  const { sub } = c.get('jwtPayload')

  if (id === sub) return c.json(Resp.fail('不能删除当前登录用户'), HttpStatusCodes.FORBIDDEN)

  // Check if built-in user / 检查是否为内置用户
  const [user] = await db.select({ builtIn: systemUsers.builtIn }).from(systemUsers).where(eq(systemUsers.id, id))

  if (!user) {
    return c.json(Resp.fail(HttpStatusPhrases.NOT_FOUND), HttpStatusCodes.NOT_FOUND)
  }

  if (user.builtIn) {
    return c.json(Resp.fail('内置用户不允许删除'), HttpStatusCodes.FORBIDDEN)
  }

  const [deleted] = await db.delete(systemUsers).where(eq(systemUsers.id, id)).returning({ id: systemUsers.id })

  if (!deleted) {
    return c.json(Resp.fail(HttpStatusPhrases.NOT_FOUND), HttpStatusCodes.NOT_FOUND)
  }

  return c.json(Resp.ok(deleted), HttpStatusCodes.OK)
}
