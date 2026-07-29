import { eq } from 'drizzle-orm'

import db from '@/db'
import { systemMenuGroups, systemMenus } from '@/db/schema'
import { HttpStatusCodes } from '@monorepo/server-core'
import { Resp } from '@/utils'

import type { MenuGroupRouteHandlerType } from './menu-groups.types'

export const list: MenuGroupRouteHandlerType<'list'> = async (c) => {
  const groups = await db.select().from(systemMenuGroups).orderBy(systemMenuGroups.order, systemMenuGroups.name)
  return c.json(Resp.ok(groups), HttpStatusCodes.OK)
}

export const create: MenuGroupRouteHandlerType<'create'> = async (c) => {
  const body = c.req.valid('json')
  const { sub } = c.get('jwtPayload')
  const [created] = await db
    .insert(systemMenuGroups)
    .values({ ...body, createdBy: sub })
    .returning()
  return c.json(Resp.ok(created), HttpStatusCodes.CREATED)
}

export const update: MenuGroupRouteHandlerType<'update'> = async (c) => {
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

export const remove: MenuGroupRouteHandlerType<'remove'> = async (c) => {
  const { id } = c.req.valid('param')
  const referenced = await db.select({ id: systemMenus.id }).from(systemMenus).where(eq(systemMenus.groupId, id)).limit(1)
  if (referenced.length > 0) return c.json(Resp.fail('分组下仍有菜单，请先移动或删除菜单'), HttpStatusCodes.CONFLICT)

  const [deleted] = await db.delete(systemMenuGroups).where(eq(systemMenuGroups.id, id)).returning({ id: systemMenuGroups.id })
  if (!deleted) return c.json(Resp.fail('菜单分组不存在'), HttpStatusCodes.NOT_FOUND)
  return c.json(Resp.ok(deleted), HttpStatusCodes.OK)
}
