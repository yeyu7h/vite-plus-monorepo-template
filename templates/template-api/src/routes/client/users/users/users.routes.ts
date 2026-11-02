import { createRoute } from '@hono/zod-openapi'
import { clientUserSchema } from '@/lib/services/client-auth/contracts'
import { respErrSchema } from '@/utils'

import { RefineResultSchema } from '@/lib/core/refine-query'
import { HttpStatusCodes } from '@monorepo/server-core'
import { jsonContent } from '@monorepo/server-core'

const tags = ['/client-users (用户端用户)']

export const getUsersInfo = createRoute({
  path: '/client-users/info',
  method: 'get',
  tags,
  summary: '获取用户信息',
  responses: {
    401: jsonContent(respErrSchema, '登录会话失效'),
    403: jsonContent(respErrSchema, '账号已禁用'),
    503: jsonContent(respErrSchema, '登录服务暂不可用'),
    [HttpStatusCodes.OK]: jsonContent(RefineResultSchema(clientUserSchema), '列表响应成功'),
  },
})
