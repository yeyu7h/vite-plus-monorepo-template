import type { ClientBindings, ClientJwtPayload } from '@monorepo/server-core'
import type { MiddlewareHandler } from 'hono'
import { basePath } from 'hono/route'
import { Resp } from '@/utils'
import { ClientAuthError } from '@/lib/services/client-auth/contracts'

export type ClientAuthenticate = (token: string) => Promise<{ payload: ClientJwtPayload }>

/** Only login and refresh are public; all other client routes require an active session. */
export function createClientAuthentication(authenticate: ClientAuthenticate): MiddlewareHandler<ClientBindings> {
  return async (c, next) => {
    // Resolve nested and parameterized mounts before matching tier-relative public routes / 匹配 tier 相对路径的公共路由前，先解析嵌套及参数化挂载
    const prefix = basePath(c).replace(/\/+$/, '')
    const path = c.req.path.slice(prefix.length).replace(/\/+$/, '')
    if (c.req.method === 'POST' && ['/auth/login', '/auth/refresh'].includes(path)) return next()
    const match = /^Bearer\s+(\S+)$/i.exec(c.req.header('Authorization') ?? '')
    if (!match) return c.json(Resp.fail('需要登录', { code: 'UNAUTHORIZED' }), 401)
    try {
      const { payload } = await authenticate(match[1])
      if (typeof payload.sub !== 'string' || !payload.sub.trim()) throw new ClientAuthError()
      c.set('jwtPayload', payload)
    } catch (error) {
      if (error instanceof ClientAuthError)
        return c.json(Resp.fail(error.message, { code: error.reason === 'disabled' ? 'ACCOUNT_DISABLED' : 'UNAUTHORIZED' }), error.reason === 'disabled' ? 403 : 401)
      return c.json(Resp.fail('登录服务暂不可用', { code: 'AUTH_UNAVAILABLE' }), 503)
    }
    return next()
  }
}
