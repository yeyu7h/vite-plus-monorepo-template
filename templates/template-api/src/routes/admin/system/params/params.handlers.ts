import type { z } from 'zod'
import { systemParamValueSchema, type systemParamResponseSchema } from './params.schema'
import type { SystemParamRouteHandlerType } from './params.types'

import { eq } from 'drizzle-orm'

import db from '@/db'
import { systemParams } from '@/db/schema'
import { executeRefineQuery, RefineQueryParamsSchema } from '@/lib/core/refine-query'
import { HttpStatusCodes } from '@monorepo/server-core'
import { invalidateConfigCache } from '@/lib/services/config-cache'
import { Resp } from '@/utils'

/** List query / 列表查询 */
export const list: SystemParamRouteHandlerType<'list'> = async (c) => {
  // Get query params / 获取查询参数
  const query = c.req.query()

  const parseResult = RefineQueryParamsSchema.safeParse(query)
  if (!parseResult.success) {
    return c.json(Resp.fail(parseResult.error), HttpStatusCodes.UNPROCESSABLE_ENTITY)
  }

  // Execute query / 执行查询
  const [error, result] = await executeRefineQuery<z.infer<typeof systemParamResponseSchema>>({
    table: systemParams,
    queryParams: parseResult.data,
  })

  if (error) {
    return c.json(Resp.fail(error.message), HttpStatusCodes.INTERNAL_SERVER_ERROR)
  }

  // Set x-total-count header / 设置 x-total-count 标头
  c.header('x-total-count', result.total.toString())

  return c.json(Resp.ok(result.data), HttpStatusCodes.OK)
}

/** Create parameter / 创建参数 */
export const create: SystemParamRouteHandlerType<'create'> = async (c) => {
  const body = c.req.valid('json')
  const { sub } = c.get('jwtPayload')

  const [created] = await db
    .insert(systemParams)
    .values({
      ...body,
      createdBy: sub,
    })
    .returning()

  await invalidateConfigCache('param', [created.key])

  return c.json(Resp.ok(created), HttpStatusCodes.CREATED)
}

/** Get parameter details / 获取参数详情 */
export const get: SystemParamRouteHandlerType<'get'> = async (c) => {
  const { id } = c.req.valid('param')

  const param = await db.query.systemParams.findFirst({
    where: { id },
  })

  if (!param) {
    return c.json(Resp.fail('参数不存在'), HttpStatusCodes.NOT_FOUND)
  }

  return c.json(Resp.ok(param), HttpStatusCodes.OK)
}

/** Update parameter / 更新参数 */
export const update: SystemParamRouteHandlerType<'update'> = async (c) => {
  const { id } = c.req.valid('param')
  const body = c.req.valid('json')
  const { sub } = c.get('jwtPayload')

  const result = await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(systemParams).where(eq(systemParams.id, id)).for('update')
    if (!existing) return { status: 'not_found' } as const

    if (body.value !== undefined || body.valueType !== undefined) {
      const validation = systemParamValueSchema.safeParse({ value: body.value ?? existing.value, valueType: body.valueType ?? existing.valueType })
      if (!validation.success) return { status: 'invalid', error: validation.error } as const
    }

    const [updated] = await tx
      .update(systemParams)
      .set({ ...body, updatedBy: sub })
      .where(eq(systemParams.id, id))
      .returning()
    return { status: 'updated', updated, previousKey: existing.key } as const
  })

  // If no records were updated, the parameter does not exist / 如果没有更新任何记录，说明参数不存在
  if (result.status === 'not_found') {
    return c.json(Resp.fail('参数不存在'), HttpStatusCodes.NOT_FOUND)
  }
  if (result.status === 'invalid') return c.json(Resp.fail(result.error), HttpStatusCodes.UNPROCESSABLE_ENTITY)

  const { updated, previousKey } = result
  await invalidateConfigCache('param', [previousKey, updated.key])

  return c.json(Resp.ok(updated), HttpStatusCodes.OK)
}

/** Delete parameter / 删除参数 */
export const remove: SystemParamRouteHandlerType<'remove'> = async (c) => {
  const { id } = c.req.valid('param')

  // Delete directly, get deleted record via returning / 直接删除，通过 returning 获取被删除的记录
  const [deleted] = await db.delete(systemParams).where(eq(systemParams.id, id)).returning({ id: systemParams.id, key: systemParams.key })

  // If no records were deleted, the parameter does not exist / 如果没有删除任何记录，说明参数不存在
  if (!deleted) {
    return c.json(Resp.fail('参数不存在'), HttpStatusCodes.NOT_FOUND)
  }

  await invalidateConfigCache('param', [deleted.key])

  return c.json(Resp.ok({ id: deleted.id }), HttpStatusCodes.OK)
}
