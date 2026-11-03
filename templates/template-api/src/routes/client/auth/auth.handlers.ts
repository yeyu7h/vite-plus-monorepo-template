import type { Context } from 'hono'
import type { ClientBindings } from '@monorepo/server-core'
import { MiniappAuthError } from '@/lib/services/miniapp-auth/errors'
import { miniappAuth, clientSessions } from '@/lib/services/client-auth'
import { resolveMiniappUser, findActiveClientUser } from '@/lib/services/client-auth/accounts'
import { clientPayloadSchema, ClientAuthError } from '@/lib/services/client-auth/contracts'
import logger from '@/lib/services/logger'
import { Resp } from '@/utils'
import type { ClientAuthHandler } from './auth.types'

function failure(c: Context<ClientBindings>, error: unknown) {
  if (error instanceof ClientAuthError) return c.json(Resp.fail(error.message, { code: error.reason === 'disabled' ? 'ACCOUNT_DISABLED' : 'UNAUTHORIZED' }), error.reason === 'disabled' ? 403 : 401)
  if (error instanceof MiniappAuthError) {
    if (error.code === 'APP_NOT_CONFIGURED') return c.json(Resp.fail('小程序应用未配置', { code: error.code }), 400)
    if (error.code === 'INVALID_CODE') return c.json(Resp.fail('平台凭证无效，请重新获取后登录', { code: error.code }), 401)
    return c.json(Resp.fail('平台登录暂不可用，请稍后重试', { code: error.code }), 503)
  }
  // Transport errors may contain secrets, one-use codes and raw responses; never log them / 传输错误可能包含密钥、一次性凭证和原始响应，禁止记录
  logger.error({ requestId: c.get('requestId'), errorType: error instanceof Error ? error.name : 'UnknownError' }, '[ClientAuth]: login service unavailable')
  return c.json(Resp.fail('登录服务暂不可用', { code: 'AUTH_UNAVAILABLE' }), 503)
}

export const login: ClientAuthHandler<'login'> = async (c) => {
  c.header('Cache-Control', 'no-store')
  const { appKey, code } = c.req.valid('json')
  try {
    const identity = await miniappAuth.verify(appKey, code)
    const account = await resolveMiniappUser(identity)
    const pair = await clientSessions.create(account.user.id, appKey)
    return c.json(Resp.ok({ ...account, ...pair }), 200)
  } catch (error) {
    return failure(c, error)
  }
}

export const refresh: ClientAuthHandler<'refresh'> = async (c) => {
  c.header('Cache-Control', 'no-store')
  try {
    return c.json(Resp.ok(await clientSessions.refresh(c.req.valid('json').refreshToken)), 200)
  } catch (error) {
    return failure(c, error)
  }
}

export const logout: ClientAuthHandler<'logout'> = async (c) => {
  c.header('Cache-Control', 'no-store')
  try {
    const payload = clientPayloadSchema.parse(c.get('jwtPayload'))
    await clientSessions.revoke(payload.sessionId)
    return c.json(Resp.ok({}), 200)
  } catch (error) {
    return failure(c, error)
  }
}

export const userinfo: ClientAuthHandler<'userinfo'> = async (c) => {
  c.header('Cache-Control', 'no-store')
  try {
    const user = await findActiveClientUser(c.get('jwtPayload').sub)
    if (!user) throw new ClientAuthError()
    return c.json(Resp.ok(user), 200)
  } catch (error) {
    return failure(c, error)
  }
}
