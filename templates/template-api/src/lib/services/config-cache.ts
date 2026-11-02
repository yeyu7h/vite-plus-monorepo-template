import logger from './logger'
import redisClient from './redis'

/** Invalidate lists as well as both names of a renamed public configuration. */
export async function invalidateConfigCache(category: 'dict' | 'param', names: readonly string[]): Promise<void> {
  const keys = [`${category}s:all`, ...new Set(names.map((name) => `${category}:${name}`))]
  try {
    await redisClient.del(...keys)
  } catch (error) {
    logger.warn({ error, keys }, '[配置]: 清除缓存失败')
  }
}
