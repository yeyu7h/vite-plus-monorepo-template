import { HttpStatusCodes } from '@monorepo/server-core'
import { getAdminActorRoles } from '@/lib/services/admin-session'
import logger from '@/lib/services/logger'
import { Resp } from '@/utils'

import { clearCacheCategory, evictCacheKey, listCache } from './cache.service'
import type { CacheRouteHandlerType } from './cache.types'

export const list: CacheRouteHandlerType<'list'> = async (c) => {
  if (!(await getAdminActorRoles(c.get('jwtPayload')))?.includes('admin')) return c.json(Resp.fail('仅管理员可查看缓存'), HttpStatusCodes.FORBIDDEN)
  const { category, cursor } = c.req.valid('query')
  return c.json(Resp.ok(await listCache(category, cursor)), HttpStatusCodes.OK)
}

export const remove: CacheRouteHandlerType<'remove'> = async (c) => {
  const { sub } = c.get('jwtPayload')
  if (!(await getAdminActorRoles(c.get('jwtPayload')))?.includes('admin')) return c.json(Resp.fail('仅管理员可清除缓存'), HttpStatusCodes.FORBIDDEN)
  const { key } = c.req.valid('param')
  const deleted = await evictCacheKey(key)
  if (deleted === null) return c.json(Resp.fail('此键不属于可管理的业务缓存'), HttpStatusCodes.BAD_REQUEST)
  logger.info({ userId: sub, key, deleted }, '[缓存管理]: 清除缓存键')
  return c.json(Resp.ok({ deleted }), HttpStatusCodes.OK)
}

export const clear: CacheRouteHandlerType<'clear'> = async (c) => {
  const { sub } = c.get('jwtPayload')
  if (!(await getAdminActorRoles(c.get('jwtPayload')))?.includes('admin')) return c.json(Resp.fail('仅管理员可清除缓存'), HttpStatusCodes.FORBIDDEN)
  const { category, cursor } = c.req.valid('json')
  const result = await clearCacheCategory(category, cursor)
  logger.info({ userId: sub, category, ...result }, '[缓存管理]: 清除缓存类别')
  return c.json(Resp.ok(result), HttpStatusCodes.OK)
}
