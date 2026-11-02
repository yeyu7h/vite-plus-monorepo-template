import { createRoute, z } from '@hono/zod-openapi'
import { jsonContent, jsonContentRequired } from '@monorepo/server-core'
import { RefineResultSchema } from '@/lib/core/refine-query'
import { createRateLimiter } from '@/lib/core/rate-limit-factory'
import { AUTH_RATE_LIMIT_MAX_REQUESTS, AUTH_RATE_LIMIT_WINDOW_MS } from '@/lib/constants/rate-limit'
import { clientUserSchema } from '@/lib/services/client-auth/contracts'
import { respErrSchema } from '@/utils'
import { miniappLoginSchema, refreshSchema, loginResultSchema, tokenPairSchema } from './auth.schema'

const tags = ['/client/auth (小程序身份认证)']
const authRateLimit = createRateLimiter({ windowMs: AUTH_RATE_LIMIT_WINDOW_MS, limit: AUTH_RATE_LIMIT_MAX_REQUESTS, prefix: 'rl:client-auth:' })
const errors = {
  400: jsonContent(respErrSchema, '应用未配置或参数错误'),
  401: jsonContent(respErrSchema, '登录凭证无效或已过期'),
  403: jsonContent(respErrSchema, '账号已禁用'),
  422: jsonContent(respErrSchema, '请求参数校验失败'),
  429: jsonContent(respErrSchema, '请求过于频繁'),
  503: jsonContent(respErrSchema, '平台或登录服务暂不可用'),
}

export const login = createRoute({
  path: '/auth/login',
  method: 'post',
  tags,
  summary: '微信 / 支付宝小程序登录（首次自动注册）',
  middleware: [authRateLimit] as const,
  request: { body: jsonContentRequired(miniappLoginSchema, '临时平台凭证') },
  responses: { 200: jsonContent(RefineResultSchema(loginResultSchema), '登录成功'), ...errors },
})
export const refresh = createRoute({
  path: '/auth/refresh',
  method: 'post',
  tags,
  summary: '轮换刷新令牌并获取新的客户端 Token',
  middleware: [authRateLimit] as const,
  request: { body: jsonContentRequired(refreshSchema, '业务 Refresh Token') },
  responses: { 200: jsonContent(RefineResultSchema(tokenPairSchema), '刷新成功'), ...errors },
})
export const logout = createRoute({
  path: '/auth/logout',
  method: 'post',
  tags,
  summary: '撤销当前客户端登录会话',
  responses: { 200: jsonContent(RefineResultSchema(z.object({})), '退出成功'), ...errors },
})
export const userinfo = createRoute({
  path: '/auth/userinfo',
  method: 'get',
  tags,
  summary: '获取当前业务用户信息',
  responses: { 200: jsonContent(RefineResultSchema(clientUserSchema), '当前用户信息'), ...errors },
})
