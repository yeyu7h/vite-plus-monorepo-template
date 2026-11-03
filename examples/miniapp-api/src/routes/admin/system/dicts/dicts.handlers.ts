import type { z } from 'zod'
import type { systemDictResponseSchema } from './dicts.schema'
import type { SystemDictRouteHandlerType } from './dicts.types'

import { eq } from 'drizzle-orm'

import db from '@/db'
import { systemDicts } from '@/db/schema'
import { executeRefineQuery, RefineQueryParamsSchema } from '@/lib/core/refine-query'
import { HttpStatusCodes } from '@monorepo/server-core'
import { invalidateConfigCache } from '@/lib/services/config-cache'
import { Resp } from '@/utils'

/** List query / 列表查询 */
export const list: SystemDictRouteHandlerType<'list'> = async (c) => {
  // Get query params / 获取查询参数
  const query = c.req.query()

  const parseResult = RefineQueryParamsSchema.safeParse(query)
  if (!parseResult.success) {
    return c.json(Resp.fail(parseResult.error), HttpStatusCodes.UNPROCESSABLE_ENTITY)
  }

  // Execute query / 执行查询
  const [error, result] = await executeRefineQuery<z.infer<typeof systemDictResponseSchema>>({
    table: systemDicts,
    queryParams: parseResult.data,
  })

  if (error) {
    return c.json(Resp.fail(error.message), HttpStatusCodes.INTERNAL_SERVER_ERROR)
  }

  // Set x-total-count header / 设置 x-total-count 标头
  c.header('x-total-count', result.total.toString())

  return c.json(Resp.ok(result.data), HttpStatusCodes.OK)
}

/** Create dictionary / 创建字典 */
export const create: SystemDictRouteHandlerType<'create'> = async (c) => {
  const body = c.req.valid('json')
  const { sub } = c.get('jwtPayload')

  const [created] = await db
    .insert(systemDicts)
    .values({
      ...body,
      createdBy: sub,
    })
    .returning()

  await invalidateConfigCache('dict', [created.code])

  return c.json(Resp.ok(created), HttpStatusCodes.CREATED)
}

/** Get dictionary details / 获取字典详情 */
export const get: SystemDictRouteHandlerType<'get'> = async (c) => {
  const { id } = c.req.valid('param')

  const dict = await db.query.systemDicts.findFirst({
    where: { id },
  })

  if (!dict) {
    return c.json(Resp.fail('字典不存在'), HttpStatusCodes.NOT_FOUND)
  }

  return c.json(Resp.ok(dict), HttpStatusCodes.OK)
}

/** Update dictionary / 更新字典 */
export const update: SystemDictRouteHandlerType<'update'> = async (c) => {
  const { id } = c.req.valid('param')
  const body = c.req.valid('json')
  const { sub } = c.get('jwtPayload')

  const result = await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(systemDicts).where(eq(systemDicts.id, id)).for('update')
    if (!existing) return null
    const [updated] = await tx
      .update(systemDicts)
      .set({ ...body, updatedBy: sub })
      .where(eq(systemDicts.id, id))
      .returning()
    return { updated, previousCode: existing.code }
  })

  // If no records were updated, the dictionary does not exist / 如果没有更新任何记录，说明字典不存在
  if (!result) {
    return c.json(Resp.fail('字典不存在'), HttpStatusCodes.NOT_FOUND)
  }

  const { updated, previousCode } = result
  await invalidateConfigCache('dict', [previousCode, updated.code])

  return c.json(Resp.ok(updated), HttpStatusCodes.OK)
}

/** Delete dictionary / 删除字典 */
export const remove: SystemDictRouteHandlerType<'remove'> = async (c) => {
  const { id } = c.req.valid('param')

  // Delete directly, get deleted record via returning / 直接删除，通过 returning 获取被删除的记录
  const [deleted] = await db.delete(systemDicts).where(eq(systemDicts.id, id)).returning({ id: systemDicts.id, code: systemDicts.code })

  // If no records were deleted, the dictionary does not exist / 如果没有删除任何记录，说明字典不存在
  if (!deleted) {
    return c.json(Resp.fail('字典不存在'), HttpStatusCodes.NOT_FOUND)
  }

  await invalidateConfigCache('dict', [deleted.code])

  return c.json(Resp.ok({ id: deleted.id }), HttpStatusCodes.OK)
}
