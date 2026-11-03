import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

const probes = vi.hoisted(() => ({
  check: vi.fn<() => Promise<{ status: 'ready' | 'not_ready'; checks: { database: 'ok' | 'error'; redis: 'ok' | 'error' } }>>(),
  limited: vi.fn<() => Response>(),
}))

vi.mock('@/lib/infrastructure/readiness', () => ({ checkReadiness: probes.check }))
vi.mock('@/lib/core/rate-limit-factory', () => ({
  createRateLimiter: () => probes.limited,
}))

import createApp from '@/lib/core/create-app'
import health from './health.index'

const app = createApp().route('/api', health)

beforeEach(() => {
  probes.check.mockReset().mockResolvedValue({ status: 'ready', checks: { database: 'ok', redis: 'ok' } })
  probes.limited.mockClear().mockImplementation(() => new Response('limiter unavailable', { status: 503 }))
})

describe('health endpoints', () => {
  it('keeps liveness independent of dependency checks and the Redis-backed limiter', async () => {
    const response = await app.request('/api/health')
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ data: { status: 'ok' } })
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(probes.check).not.toHaveBeenCalled()
    expect(probes.limited).not.toHaveBeenCalled()
  })

  it('returns readiness without using the Redis-backed limiter', async () => {
    const response = await app.request('/api/health/ready')
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ data: { status: 'ready', checks: { database: 'ok', redis: 'ok' } } })
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(probes.check).toHaveBeenCalledTimes(1)
    expect(probes.limited).not.toHaveBeenCalled()
  })

  it('returns 503 when a dependency fails', async () => {
    probes.check.mockResolvedValue({ status: 'not_ready', checks: { database: 'ok', redis: 'error' } })
    const response = await app.request('/api/health/ready')
    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({ message: '服务尚未就绪', data: { status: 'not_ready', checks: { redis: 'error' } } })
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })

  it('supports HEAD probes', async () => {
    expect((await app.request('/api/health', { method: 'HEAD' })).status).toBe(200)
    expect((await app.request('/api/health/ready', { method: 'HEAD' })).status).toBe(200)
    expect(probes.limited).not.toHaveBeenCalled()
  })

  it.each([
    ['/api/health', 'POST'],
    ['/api/health/ready', 'POST'],
    ['/api/health-extra', 'GET'],
    ['/api/health/ready/extra', 'GET'],
  ])('keeps rate limiting for %s %s', async (path, method) => {
    const response = await app.request(path, { method })
    expect(response.status).toBe(503)
    expect(await response.text()).toBe('limiter unavailable')
    expect(probes.limited).toHaveBeenCalledTimes(1)
  })
})
