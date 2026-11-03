import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { createReadinessCheck } from './readiness'

afterEach(() => vi.useRealTimers())

describe('readiness checks', () => {
  it('requires both dependencies to succeed', async () => {
    const check = createReadinessCheck({ database: async () => 1, redis: async () => 'PONG' })
    expect(await check()).toEqual({ status: 'ready', checks: { database: 'ok', redis: 'ok' } })
  })

  it('reports failures without exposing connection strings or exception details', async () => {
    const check = createReadinessCheck({
      database: async () => {
        throw new Error('postgresql://secret@internal-database/app')
      },
      redis: async () => 'PONG',
    })
    expect(await check()).toEqual({ status: 'not_ready', checks: { database: 'error', redis: 'ok' } })
  })

  it('handles synchronous failures from either probe', async () => {
    const check = createReadinessCheck({
      database: () => {
        throw new Error('unavailable')
      },
      redis: () => {
        throw new Error('unavailable')
      },
    })
    expect(await check()).toEqual({ status: 'not_ready', checks: { database: 'error', redis: 'error' } })
  })

  it('bounds parallel probes and reuses unfinished work across polling requests', async () => {
    vi.useFakeTimers()
    const database = vi.fn<() => Promise<void>>(() => new Promise(() => {}))
    const redis = vi.fn<() => Promise<void>>(() => new Promise(() => {}))
    const check = createReadinessCheck({ database, redis })
    const first = check()
    const concurrent = check()
    await vi.advanceTimersByTimeAsync(2000)
    expect(await first).toEqual({ status: 'not_ready', checks: { database: 'error', redis: 'error' } })
    expect(await concurrent).toEqual(await first)
    const next = check()
    await vi.advanceTimersByTimeAsync(2000)
    expect(await next).toEqual(await first)
    expect(database).toHaveBeenCalledTimes(1)
    expect(redis).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('recovers after a timed-out dependency settles', async () => {
    vi.useFakeTimers()
    let recover: () => void = () => {}
    const database = vi
      .fn<() => Promise<void>>()
      .mockImplementationOnce(() => new Promise((resolve) => (recover = resolve)))
      .mockResolvedValue(undefined)
    const check = createReadinessCheck({ database, redis: async () => 'PONG' })
    const first = check()
    await vi.advanceTimersByTimeAsync(2000)
    expect((await first).status).toBe('not_ready')
    recover()
    await vi.advanceTimersByTimeAsync(0)
    expect((await check()).status).toBe('ready')
    expect(database).toHaveBeenCalledTimes(2)
    expect(vi.getTimerCount()).toBe(0)
  })
})
