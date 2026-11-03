import { createMiniappAuth } from '@/lib/services/miniapp-auth'
import env from '@/env'
import redisClient from '@/lib/services/redis'
import { createClientSessionService } from './sessions'
import { createRedisClientSessionStore } from './redis-store'
import { findActiveClientUser } from './accounts'

export const miniappAuth = createMiniappAuth({ apps: env.MINIAPP_APPS })
export const clientSessions = createClientSessionService({
  store: createRedisClientSessionStore(redisClient),
  secret: env.CLIENT_JWT_SECRET,
  accessSeconds: env.CLIENT_ACCESS_TOKEN_SECONDS,
  sessionSeconds: env.CLIENT_SESSION_SECONDS,
  findUser: findActiveClientUser,
})
