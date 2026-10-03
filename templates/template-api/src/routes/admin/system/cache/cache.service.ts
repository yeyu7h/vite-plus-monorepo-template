import redisClient from '@/lib/services/redis'

export type CacheCategory = 'dict' | 'param' | 'ip'

const patterns: Record<CacheCategory, string> = {
  dict: 'dict*',
  param: 'param*',
  ip: 'ip:location:*',
}

export function isManagedCacheKey(key: string, category?: CacheCategory): boolean {
  const matchedCategory = key === 'dicts:all' || key.startsWith('dict:') ? 'dict' : key === 'params:all' || key.startsWith('param:') ? 'param' : key.startsWith('ip:location:') ? 'ip' : null
  return matchedCategory !== null && (category === undefined || matchedCategory === category)
}

export async function listCache(category: CacheCategory, cursor: string) {
  const foundKeys = new Set<string>()
  let nextCursor = cursor
  let scans = 0
  do {
    const [next, scannedKeys] = await redisClient.scan(nextCursor, 'MATCH', patterns[category], 'COUNT', 100)
    for (const key of scannedKeys) if (isManagedCacheKey(key, category)) foundKeys.add(key)
    nextCursor = next
    scans++
  } while (nextCursor !== '0' && foundKeys.size < 100 && scans < 20)
  const keys = [...foundKeys].sort()
  const items = (
    await Promise.all(
      keys.map(async (key) => {
        const [type, ttlSeconds] = await Promise.all([redisClient.type(key), redisClient.ttl(key)])
        if (type !== 'string') return null
        const value = await redisClient.get(key)
        if (value === null) return null
        return { key, category, ttlSeconds, preview: value.slice(0, 4096), truncated: value.length > 4096 }
      }),
    )
  ).filter((item) => item !== null)
  return { items, cursor: nextCursor, hasMore: nextCursor !== '0' }
}

export async function evictCacheKey(key: string) {
  if (!isManagedCacheKey(key)) return null
  return redisClient.unlink(key)
}

export async function clearCacheCategory(category: CacheCategory, startCursor: string) {
  let cursor = startCursor
  let deleted = 0
  let scans = 0
  do {
    const [nextCursor, scannedKeys] = await redisClient.scan(cursor, 'MATCH', patterns[category], 'COUNT', 100)
    const keys = [...new Set(scannedKeys.filter((key) => isManagedCacheKey(key, category)))]
    if (keys.length > 0) deleted += await redisClient.unlink(...keys)
    cursor = nextCursor
    scans++
  } while (cursor !== '0' && scans < 20)
  return { deleted, complete: cursor === '0', cursor }
}
