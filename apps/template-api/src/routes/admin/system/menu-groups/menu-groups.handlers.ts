import type { z } from 'zod'
import type { MenuGroupsRouteHandler } from './menu-groups.types'
import type { menuGroupResponseSchema } from './menu-groups.schema'

import { count, eq } from 'drizzle-orm'

import db from '@/db'
import { systemMenuGroups, systemMenus } from '@/db/schema'
import { executeRefineQuery, RefineQueryParamsSchema } from '@/lib/core/refine-query'
import { HttpStatusCodes } from '@monorepo/server-core'
import { Resp } from '@/utils'

export const list: MenuGroupsRouteHandler<'list'> = async (c) => {
  const parsed = RefineQueryParamsSchema.safeParse(c.req.query())
  if (!parsed.success) return c.json(Resp.fail(parsed.error), HttpStatusCodes.UNPROCESSABLE_ENTITY)

  const [error, result] = await executeRefineQuery<z.infer<typeof menuGroupResponseSchema>>({
    table: systemMenuGroups,
    queryParams: parsed.data,
  })
  if (error) return c.json(Resp.fail(error.message), HttpStatusCodes.INTERNAL_SERVER_ERROR)

  c.header('x-total-count', result.total.toString())
  return c.json(Resp.ok(result.data), HttpStatusCodes.OK)
}

export const create: MenuGroupsRouteHandler<'create'> = async (c) => {
  const body = c.req.valid('json')
  const { sub } = c.get('jwtPayload')
  const [created] = await db
    .insert(systemMenuGroups)
    .values({ ...body, createdBy: sub })
    .returning()
  return c.json(Resp.ok(created), HttpStatusCodes.CREATED)
}

export const update: MenuGroupsRouteHandler<'update'> = async (c) => {
  const { id } = c.req.valid('param')
  const body = c.req.valid('json')
  const { sub } = c.get('jwtPayload')
  const [updated] = await db
    .update(systemMenuGroups)
    .set({ ...body, updatedBy: sub })
    .where(eq(systemMenuGroups.id, id))
    .returning()
  if (!updated) return c.json(Resp.fail('菜单分组不存在'), HttpStatusCodes.NOT_FOUND)
  return c.json(Resp.ok(updated), HttpStatusCodes.OK)
}

export const remove: MenuGroupsRouteHandler<'remove'> = async (c) => {
  const { id } = c.req.valid('param')
  const [reference] = await db.select({ count: count() }).from(systemMenus).where(eq(systemMenus.groupId, id))
  if ((reference?.count ?? 0) > 0) {
    return c.json(Resp.fail(`菜单分组仍被 ${reference!.count} 个菜单引用，请先调整这些菜单`), HttpStatusCodes.CONFLICT)
  }

  const [deleted] = await db.delete(systemMenuGroups).where(eq(systemMenuGroups.id, id)).returning({ id: systemMenuGroups.id })
  if (!deleted) return c.json(Resp.fail('菜单分组不存在'), HttpStatusCodes.NOT_FOUND)
  return c.json(Resp.ok(deleted), HttpStatusCodes.OK)
}
