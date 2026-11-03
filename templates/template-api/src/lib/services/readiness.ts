import { z } from 'zod'

export const readinessResultSchema = z.object({
  status: z.enum(['ready', 'not_ready']),
  checks: z.object({ database: z.enum(['ok', 'error']), redis: z.enum(['ok', 'error']) }),
})

type ReadinessResult = z.infer<typeof readinessResultSchema>
type Probe = () => PromiseLike<unknown>

function boundedProbe(probe: Probe, timeoutMs: number) {
  let pending: Promise<boolean> | undefined

  return async () => {
    // Reuse unfinished work after a timeout so polling cannot accumulate queries / 超时后复用未完成的任务，避免轮询累积查询
    pending ??= Promise.resolve()
      .then(probe)
      .then(
        () => true,
        () => false,
      )
      .finally(() => {
        pending = undefined
      })

    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      return await Promise.race([pending, new Promise<boolean>((resolve) => (timer = setTimeout(() => resolve(false), timeoutMs)))])
    } finally {
      clearTimeout(timer)
    }
  }
}

export function createReadinessCheck(probes: { database: Probe; redis: Probe }, timeoutMs = 2000) {
  const database = boundedProbe(probes.database, timeoutMs)
  const redis = boundedProbe(probes.redis, timeoutMs)

  return async (): Promise<ReadinessResult> => {
    const [databaseOk, redisOk] = await Promise.all([database(), redis()])
    return {
      status: databaseOk && redisOk ? 'ready' : 'not_ready',
      checks: { database: databaseOk ? 'ok' : 'error', redis: redisOk ? 'ok' : 'error' },
    }
  }
}
