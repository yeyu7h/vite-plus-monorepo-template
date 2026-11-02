import { randomUUID } from 'node:crypto'
import type { ClientBindings } from '@monorepo/server-core'
import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vite-plus/test'
import { createClientAuthentication } from './client-authenticate'
import { ClientAuthError } from '@/lib/services/client-auth/contracts'

function setup() {
  const authenticate = vi.fn<Parameters<typeof createClientAuthentication>[0]>().mockResolvedValue({
    payload: { sub: randomUUID(), sessionId: randomUUID(), aud: 'client', iss: 'miniapp-client', iat: 1, exp: 2 },
    user: { id: randomUUID(), uid: '100000001', nickname: '用户', avatar: null, createdAt: null },
  })
  const app = new Hono<ClientBindings>()
  app.use('*', async (c, next) => {
    c.set('tierBasePath', '/api/client')
    return next()
  })
  app.use('*', createClientAuthentication(authenticate))
  app.all('*', (c) => c.json({ ok: true }))
  return { app, authenticate }
}

describe('client route authentication boundary', () => {
  it.each(['/auth/login', '/auth/refresh', '/auth/login/'])('allows POST %s without a client JWT', async (path) => {
    const { app, authenticate } = setup()
    expect((await app.request('/api/client' + path, { method: 'POST' })).status).toBe(200)
    expect(authenticate).not.toHaveBeenCalled()
  })
  it.each(['/auth/userinfo', '/auth/logout', '/auth/login/extra', '/nested/auth/login', '/auth/refresh/extra'])('protects %s', async (path) => {
    const { app } = setup()
    expect((await app.request('/api/client' + path, { method: 'POST' })).status).toBe(401)
  })
  it('does not exempt the login path for another method', async () => {
    expect((await setup().app.request('/api/client/auth/login')).status).toBe(401)
  })
  it('validates protected requests and fails closed for an unavailable session store', async () => {
    const { app, authenticate } = setup()
    expect((await app.request('/api/client/auth/userinfo', { headers: { Authorization: 'Bearer token' } })).status).toBe(200)
    expect(authenticate).toHaveBeenCalledWith('token')
    authenticate.mockRejectedValue(new Error('redis unavailable'))
    expect((await app.request('/api/client/auth/userinfo', { headers: { Authorization: 'Bearer token' } })).status).toBe(503)
    authenticate.mockRejectedValue(new ClientAuthError('disabled'))
    expect((await app.request('/api/client/auth/userinfo', { headers: { Authorization: 'Bearer token' } })).status).toBe(403)
  })
})
