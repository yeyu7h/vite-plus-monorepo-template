import { getQueryClient } from '@/db'
import redisClient from '@/lib/services/redis'
import { createReadinessCheck } from '@/lib/services/readiness'

export const checkReadiness = createReadinessCheck({
  database: async () => {
    await getQueryClient()`SELECT 1`
  },
  redis: async () => {
    if (redisClient.status !== 'ready') throw new Error('Redis is not ready')
    await redisClient.ping()
  },
})
