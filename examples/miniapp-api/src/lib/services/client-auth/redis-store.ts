import type Redis from 'ioredis'
import { clientSessionSchema } from './contracts'
import type { ClientSessionStore } from './sessions'

const sessionKey = (id: string) => `{client-session.${id}}:session`
const refreshKey = (id: string, hash: string) => `{client-session.${id}}:refresh:${hash}`

const createScript = `
redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])
redis.call('SET', KEYS[2], '1', 'EX', ARGV[2])
return 1
`
const rotateScript = `
local ttl = redis.call('TTL', KEYS[1])
if ttl <= 0 or redis.call('EXISTS', KEYS[2]) == 0 then return 0 end
redis.call('DEL', KEYS[2])
redis.call('SET', KEYS[3], '1', 'EX', ttl)
return 1
`

/** Lua rotation is atomic; all keys for one session share a Redis Cluster hash slot. */
export function createRedisClientSessionStore(redis: Pick<Redis, 'get' | 'eval' | 'del'>): ClientSessionStore {
  return {
    async create(session, hash, ttl) {
      await redis.eval(createScript, 2, sessionKey(session.sessionId), refreshKey(session.sessionId, hash), JSON.stringify(session), ttl)
    },
    async get(id) {
      const raw = await redis.get(sessionKey(id))
      if (!raw) return null
      try {
        const parsed = clientSessionSchema.safeParse(JSON.parse(raw))
        return parsed.success ? parsed.data : null
      } catch {
        return null
      }
    },
    async rotate(id, previousHash, nextHash) {
      return (await redis.eval(rotateScript, 3, sessionKey(id), refreshKey(id, previousHash), refreshKey(id, nextHash))) === 1
    },
    async revoke(id) {
      // Remaining refresh hashes expire naturally and cannot be used without the session.
      await redis.del(sessionKey(id))
    },
  }
}
