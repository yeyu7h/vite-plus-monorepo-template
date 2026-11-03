import { randomUUID } from 'node:crypto'
import type { ClientBindings } from '@monorepo/server-core'
import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vite-plus/test'
import { createClientAuthentication, ClientAuthError } from './client-authenticate'
import type { ClientAuthenticate } from './client-authenticate'
import middlewares from '@/routes/client/_middleware'

function setup() {
  const authenticate = vi.fn<ClientAuthenticate>().mockResolvedValue({ payload: { sub: randomUUID() } })
  const app = new Hono<ClientBindings>()
  app.use('*', createClientAuthentication(authenticate))
  app.all('*', (c) => c.json({ userId: c.get('jwtPayload').sub }))
  return { app, authenticate }
}

describe('generic client authentication boundary', () => {
  it.each(['/auth/login', '/auth/refresh', '/auth/userinfo', '/notifications/subscribe'])('protects %s without implicit business login exemptions', async (path) => {
    const { app, authenticate } = setup()
    expect((await app.request(path, { method: 'POST' })).status).toBe(401)
    expect(authenticate).not.toHaveBeenCalled()
  })

  it.each([undefined, 'Bearer administrator-token', 'Bearer client-token'])('denies access until a client adapter is configured: %s', async (authorization) => {
    const app = new Hono<ClientBindings>()
    for (const middleware of middlewares) {
      if (typeof middleware !== 'function') throw new Error('Expected a direct client middleware')
      app.use('*', middleware)
    }
    app.get('/protected', (c) => c.json({ ok: true }))
    const response = await app.request('/protected', { headers: authorization ? { Authorization: authorization } : {} })
    expect(response.status).toBe(401)
  })

  it('forwards only the identity accepted by the business adapter', async () => {
    const { app, authenticate } = setup()
    authenticate.mockResolvedValue({ payload: { sub: 'business-user-123' } })
    const response = await app.request('/protected', { headers: { Authorization: 'Bearer client-token' } })
    expect(await response.json()).toEqual({ userId: 'business-user-123' })
    expect(authenticate).toHaveBeenCalledWith('client-token')
  })

  it('fails closed for expired credentials, disabled accounts, and unavailable authentication storage', async () => {
    const { app, authenticate } = setup()
    for (const [error, status] of [
      [new ClientAuthError(), 401],
      [new ClientAuthError('disabled'), 403],
      [new Error('store unavailable'), 503],
    ] as const) {
      authenticate.mockRejectedValue(error)
      const response = await app.request('/protected', { headers: { Authorization: 'Bearer token' } })
      expect(response.status).toBe(status)
    }
  })

  it('rejects an empty user ID returned by the adapter', async () => {
    const { app, authenticate } = setup()
    authenticate.mockResolvedValue({ payload: { sub: '' } })
    expect((await app.request('/protected', { headers: { Authorization: 'Bearer token' } })).status).toBe(401)
  })
})
