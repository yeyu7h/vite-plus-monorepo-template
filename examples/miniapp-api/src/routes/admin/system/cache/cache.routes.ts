import { createRoute } from '@hono/zod-openapi'
import { HttpStatusCodes, jsonContent, jsonContentRequired } from '@monorepo/server-core'
import { z } from '@hono/zod-openapi'

import { respErrSchema } from '@/utils'
import { RefineResultSchema } from '@/lib/core/refine-query'
import { cacheClearSchema, cacheKeyParamsSchema, cacheListSchema, cacheQuerySchema, clearCacheSchema } from './cache.schema'

const routePrefix = '/system/cache'
const tags = ['系统缓存管理']

export const list = createRoute({
  tags,
  summary: '查看业务 Redis 缓存',
  method: 'get',
  path: routePrefix,
  request: { query: cacheQuerySchema },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(RefineResultSchema(cacheListSchema), '缓存列表'),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(respErrSchema, '仅管理员可查看'),
  },
})

export const remove = createRoute({
  tags,
  summary: '清除一条业务 Redis 缓存',
  method: 'delete',
  path: `${routePrefix}/{key}`,
  request: { params: cacheKeyParamsSchema },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(RefineResultSchema(z.object({ deleted: z.number() })), '清除结果'),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(respErrSchema, '不允许清除此键'),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(respErrSchema, '仅管理员可清除'),
  },
})

export const clear = createRoute({
  tags,
  summary: '清除一类业务 Redis 缓存',
  method: 'post',
  path: `${routePrefix}/clear`,
  request: { body: jsonContentRequired(clearCacheSchema, '缓存类别') },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(RefineResultSchema(cacheClearSchema), '清除结果'),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(respErrSchema, '仅管理员可清除'),
  },
})
