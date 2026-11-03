import type { ClientBindings } from '@monorepo/server-core'
import type { MiddlewareHandler } from 'hono'
import { Resp } from '@/utils'
import { ClientAuthError } from '@/lib/services/client-auth/contracts'
import type { createClientSessionService } from '@/lib/services/client-auth/sessions'

type Authenticate = ReturnType<typeof createClientSessionService>['authenticate']

/** Exact method/path exceptions; all other client routes require an active session and account. */
export function createClientAuthentication(authenticate: Authenticate): MiddlewareHandler<ClientBindings> {
  return async (c, next) => {
    const basePath = c.get('tierBasePath')
    const path = c.req.path.replace(/\/+$/, '')
    if (c.req.method === 'POST' && [basePath + '/auth/login', basePath + '/auth/refresh'].includes(path)) return next()
    const match = /^Bearer\s+(\S+)$/i.exec(c.req.header('Authorization') ?? '')
    if (!match) return c.json(Resp.fail('需要登录', { code: 'UNAUTHORIZED' }), 401)
    try {
      const { payload } = await authenticate(match[1])
      c.set('jwtPayload', payload)
    } catch (error) {
      if (error instanceof ClientAuthError)
        return c.json(Resp.fail(error.message, { code: error.reason === 'disabled' ? 'ACCOUNT_DISABLED' : 'UNAUTHORIZED' }), error.reason === 'disabled' ? 403 : 401)
      return c.json(Resp.fail('登录服务暂不可用', { code: 'AUTH_UNAVAILABLE' }), 503)
    }
    return next()
  }
}
