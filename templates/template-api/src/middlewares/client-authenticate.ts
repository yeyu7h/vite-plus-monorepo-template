import type { ClientBindings, ClientJwtPayload } from '@monorepo/server-core'
import type { MiddlewareHandler } from 'hono'
import { Resp } from '@/utils'

export class ClientAuthError extends Error {
  readonly reason: 'unauthorized' | 'disabled'
  constructor(reason: 'unauthorized' | 'disabled' = 'unauthorized') {
    super(reason === 'disabled' ? '账号已被禁用' : '登录凭证无效或已过期')
    this.name = 'ClientAuthError'
    this.reason = reason
  }
}

/** The business app verifies its own token, session and account, then returns a trusted client identity. */
export type ClientAuthenticate = (token: string) => Promise<{ payload: ClientJwtPayload }>

const unconfigured: ClientAuthenticate = async () => {
  throw new ClientAuthError()
}

/** All client routes are protected. Business login/refresh exemptions must be configured explicitly. */
export function createClientAuthentication(authenticate: ClientAuthenticate = unconfigured): MiddlewareHandler<ClientBindings> {
  return async (c, next) => {
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
