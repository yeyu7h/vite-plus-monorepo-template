import { Enforcer, Util } from 'casbin'

import { createAdminMiddleware } from '@monorepo/server-core'
import { HttpStatusCodes } from '@monorepo/server-core'
import { HttpStatusPhrases } from '@monorepo/server-core'
import { enforcerPromise } from '@/lib/services/casbin'
import { getAdminSession } from '@/lib/services/admin-session'
import { Resp } from '@/utils'
import { stripPrefix } from '@monorepo/utils'

/**
 * Casbin permission check middleware (Admin only)
 * Verifies if the current user has access to the specified endpoint
 * Casbin 权限校验中间件（仅管理端）
 * 用于校验当前用户是否有访问指定接口的权限
 */
export const authorize = createAdminMiddleware(async (c, next) => {
  const { sub, roles, sessionId } = c.get('jwtPayload')

  if (typeof sub !== 'string' || !Array.isArray(roles)) {
    return c.json(Resp.fail(HttpStatusPhrases.FORBIDDEN), HttpStatusCodes.FORBIDDEN)
  }

  const session = sessionId ? await getAdminSession(sub, sessionId) : null
  if (sessionId && !session) return c.json(Resp.fail(HttpStatusPhrases.UNAUTHORIZED), HttpStatusCodes.UNAUTHORIZED)
  const directRoles = session?.roles ?? roles

  // admin 自动拥有管理端接口权限，不依赖 seed 中的静态策略。
  if (directRoles.includes('admin')) {
    await next()
    return
  }

  // Strip API prefix to get the actual request path / 去除 API 前缀，获取实际请求路径
  const path = stripPrefix(c.req.path, c.get('tierBasePath') ?? '')

  // New logins use the Redis permission snapshot. Tokens issued before the
  // session migration retain their former Casbin behavior until expiry.
  let hasPermission: boolean
  if (session) {
    hasPermission = session.permissions.some(([, resource, action]) => !!resource && !!action && Util.keyMatch3Func(path, resource) && Util.regexMatchFunc(c.req.method, action))
  } else {
    const enforcer = await enforcerPromise
    if (!(enforcer instanceof Enforcer)) return c.json(Resp.fail(HttpStatusPhrases.INTERNAL_SERVER_ERROR), HttpStatusCodes.INTERNAL_SERVER_ERROR)
    hasPermission = (await Promise.all(directRoles.map((role) => enforcer.enforce(role, path, c.req.method)))).some(Boolean)
  }

  // Return 403 if no permission / 无权限则返回 403
  if (!hasPermission) {
    return c.json(Resp.fail(HttpStatusPhrases.FORBIDDEN), HttpStatusCodes.FORBIDDEN)
  }

  // Proceed to next middleware if authorized / 有权限则继续后续中间件
  await next()
})
