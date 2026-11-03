import { sentry } from '@hono/sentry'
import { createAdminRouter, createClientRouter, createPublicRouter, createRouter, createTierRouter, HttpStatusCodes } from '@monorepo/server-core'
import { pinoLogger } from 'hono-pino'
import { bodyLimit } from 'hono/body-limit'
import { compress } from 'hono/compress'
import { cors } from 'hono/cors'
import { requestId } from 'hono/request-id'
import { secureHeaders } from 'hono/secure-headers'
import { timeout } from 'hono/timeout'

import { trimTrailingSlash } from 'hono/trailing-slash'

import { RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS } from '@/lib/constants/rate-limit'
import { notFound, onError, serveEmojiFavicon } from '@/lib/core/stoker/middlewares'
import { Resp } from '@/utils'
import env from '@/env'

import logger from '../services/logger'
import { createRateLimiter } from './rate-limit-factory'

export { createAdminRouter, createClientRouter, createPublicRouter, createRouter, createTierRouter }

export default function createApp() {
  const app = createRouter()

  /** 1. Request ID - generated first for full chain tracing / 请求ID - 最先生成，用于全链路追踪 */
  app.use(requestId())

  /** 2. Logging - record early, including intercepted requests / 日志记录 - 尽早记录，包括被拦截的请求 */
  // Skip low-observability client tier request logs (high-frequency, self-service and SSE heartbeats) to reduce SLS costs / 跳过观测价值低的客户端 tier 请求日志（高频、用户自助及 SSE 心跳），降低 SLS 成本
  // Also skip the high-frequency public dictionary and parameter endpoints / 同时跳过高频的公共字典和参数接口
  // Hono Context is invariant in Variables; `pinoLogger` expects `{ logger }` while `BaseVariables` is a superset, so pass it through with a double assertion / Hono Context 对 Variables 是 invariant，`pinoLogger` 要求 `{ logger }`，而 `BaseVariables` 是其超集，需双重断言透传
  const requestLogger = pinoLogger({ pino: logger })
  // Use an exact-match skip set for O(1) lookup; add new paths as strings / 使用精确匹配跳过集合进行 O(1) 查找，新增路径只需往 Set 中加字符串
  const SKIP_LOG_PATHS = new Set<string>(['/api/dicts', '/api/params'])
  app.use(async (c, next) => {
    const path = c.req.path
    if (path.startsWith('/api/client/') || SKIP_LOG_PATHS.has(path)) return next()
    return requestLogger(c as unknown as Parameters<typeof requestLogger>[0], next)
  })

  /** 3. Security headers / 安全头部 */
  app.use(secureHeaders())

  /** 4. Timeout control - set early to control entire request chain / 超时控制 - 尽早设置，控制整个请求链 */
  app.use(timeout(30000))

  /** 5. Rate limiting - intercept before parsing request body / 速率限制 - 在解析请求体之前拦截 */
  const globalRateLimit = createRateLimiter({ windowMs: RATE_LIMIT_WINDOW_MS, limit: RATE_LIMIT_MAX_REQUESTS, prefix: 'rl:global:' })
  app.use((c, next) => {
    const path = c.req.path.replace(/\/+$/, '')
    // Probes must remain reachable when the Redis-backed limiter is unavailable / Redis 限流器不可用时探针仍必须可访问
    if ((c.req.method === 'GET' || c.req.method === 'HEAD') && (path === '/api/health' || path === '/api/health/ready')) return next()
    return globalRateLimit(c, next)
  })

  /** 6. Basic features / 基础功能 */
  app.use(trimTrailingSlash())
  app.use(cors())

  /** 7. Request body limit - limit before actual parsing / 请求体限制 - 在实际解析前限制 */
  app.on(
    ['POST', 'PUT', 'PATCH'],
    '*',
    bodyLimit({
      maxSize: 1 * 1024 * 1024,
      onError: (c) => {
        return c.json(Resp.fail('请求体过大（超过 1MB）'), HttpStatusCodes.REQUEST_TOO_LONG)
      },
    }),
  )

  /** 8. Compression and static resources / 压缩和静态资源 */
  if (process.env.NODE_ENV === 'production') {
    app.use(compress())
  }
  app.use(serveEmojiFavicon('📝'))

  if (env.SENTRY_DSN) {
    app.use('*', sentry({ dsn: env.SENTRY_DSN }))
  }

  /** 9. Error handling / 错误处理 */
  app.notFound(notFound)
  app.onError(onError)

  return app
}
