import { createRoute, z } from '@hono/zod-openapi'

import { RefineResultSchema } from '@/lib/core/refine-query'
import { HttpStatusCodes } from '@monorepo/server-core'
import { jsonContent } from '@monorepo/server-core'
import { readinessResultSchema } from '@/lib/services/readiness'
import { respErrSchema } from '@/utils'

const routePrefix = '/health'
const tags = [`${routePrefix}（健康检查）`]

const HealthResponseSchema = z.object({
  status: z.string().meta({ description: '健康状态' }),
  timestamp: z.string().meta({ description: '时间戳' }),
})

/** Health check endpoint / 健康检查接口 */
export const get = createRoute({
  tags,
  path: routePrefix,
  method: 'get',
  summary: '进程存活检查',
  description: '仅检查 HTTP 进程存活，不探测外部依赖',
  responses: {
    [HttpStatusCodes.OK]: jsonContent(RefineResultSchema(HealthResponseSchema), '服务正常'),
  },
})

const readinessResponseSchema = readinessResultSchema.extend({ timestamp: z.string() })

export const ready = createRoute({
  tags,
  path: `${routePrefix}/ready`,
  method: 'get',
  summary: '服务就绪检查',
  description: '并行执行 PostgreSQL SELECT 1 与 Redis PING，每项最多等待 2 秒；依赖不可用或超时时返回 503',
  responses: {
    [HttpStatusCodes.OK]: jsonContent(RefineResultSchema(readinessResponseSchema), '服务已就绪'),
    [HttpStatusCodes.SERVICE_UNAVAILABLE]: jsonContent(respErrSchema.extend({ data: readinessResponseSchema }), '服务尚未就绪'),
  },
})
