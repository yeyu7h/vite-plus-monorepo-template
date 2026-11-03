import type { ClientUsersRouteHandlerType } from './users.types'
import { HttpStatusCodes } from '@monorepo/server-core'

import { Resp } from '@/utils/zod'
import { findActiveClientUser } from '@/lib/services/client-auth/accounts'
import { ClientAuthError } from '@/lib/services/client-auth/contracts'

export const getUsersInfo: ClientUsersRouteHandlerType<'getUsersInfo'> = async (c) => {
  c.header('Cache-Control', 'no-store')
  try {
    const user = await findActiveClientUser(c.get('jwtPayload').sub)
    if (!user) return c.json(Resp.fail('登录会话失效'), 401)
    return c.json(Resp.ok(user), HttpStatusCodes.OK)
  } catch (error) {
    if (error instanceof ClientAuthError && error.reason === 'disabled') return c.json(Resp.fail(error.message), 403)
    return c.json(Resp.fail('登录服务暂不可用'), 503)
  }
}
