import { randomUUID } from 'node:crypto'
import { createApplication, createClientRouter, createRouter } from '@monorepo/server-core'
import { describe, expect, it, vi } from 'vite-plus/test'
import { createClientAuthentication } from './client-authenticate'
import { ClientAuthError } from '@/lib/services/client-auth/contracts'

async function setup({ basePath = '/', mountPaths = [], clientBasePath = '/api/client' }: { basePath?: string; mountPaths?: string[]; clientBasePath?: string } = {}) {
  const authenticate = vi.fn<Parameters<typeof createClientAuthentication>[0]>().mockResolvedValue({
    payload: { sub: randomUUID(), sessionId: randomUUID(), aud: 'client', iss: 'miniapp-client', iat: 1, exp: 2 },
  })
  const router = createClientRouter()
  router.all('*', (c) => c.json({ ok: true }))
  let app = await createApplication(
    {
      openapi: { enabled: false },
      tiers: [{ name: 'client', title: 'Client', basePath: clientBasePath, routes: { client: { default: router } }, middlewares: [createClientAuthentication(authenticate)] }],
    },
    { env: {}, version: '1.0.0', routes: {}, middlewares: {}, createApp: () => createRouter().basePath(basePath) },
  )
  for (const prefix of mountPaths) app = createRouter().route(prefix, app)
  return { app, authenticate }
}

describe('client route authentication boundary', () => {
  it.each(['/auth/login', '/auth/refresh', '/auth/login/'])('allows POST %s without a client JWT', async (path) => {
    const { app, authenticate } = await setup()
    expect((await app.request('/api/client' + path, { method: 'POST' })).status).toBe(200)
    expect(authenticate).not.toHaveBeenCalled()
  })
  it.each(['/auth/userinfo', '/auth/logout', '/auth/login/extra', '/nested/auth/login', '/auth/refresh/extra'])('protects %s', async (path) => {
    const { app } = await setup()
    expect((await app.request('/api/client' + path, { method: 'POST' })).status).toBe(401)
  })
  it('does not exempt the login path for another method', async () => {
    const { app } = await setup()
    expect((await app.request('/api/client/auth/login')).status).toBe(401)
  })
  it('validates protected requests and fails closed for an unavailable session store', async () => {
    const { app, authenticate } = await setup()
    expect((await app.request('/api/client/auth/userinfo', { headers: { Authorization: 'Bearer token' } })).status).toBe(200)
    expect(authenticate).toHaveBeenCalledWith('token')
    authenticate.mockRejectedValue(new Error('redis unavailable'))
    expect((await app.request('/api/client/auth/userinfo', { headers: { Authorization: 'Bearer token' } })).status).toBe(503)
    authenticate.mockRejectedValue(new ClientAuthError('disabled'))
    expect((await app.request('/api/client/auth/userinfo', { headers: { Authorization: 'Bearer token' } })).status).toBe(403)
  })
  it('rejects an empty user ID returned by the authentication adapter', async () => {
    const { app, authenticate } = await setup()
    authenticate.mockResolvedValueOnce({ payload: { sub: '' } })
    expect((await app.request('/api/client/auth/userinfo', { headers: { Authorization: 'Bearer token' } })).status).toBe(401)
  })

  it.each([
    { name: 'a root base path', basePath: '/root', mountPaths: [], prefix: '/root/api/client' },
    { name: 'a parent prefix', mountPaths: ['/gateway'], prefix: '/gateway/api/client' },
    { name: 'nested prefixes', basePath: '/root', mountPaths: ['/inner', '/outer'], prefix: '/outer/inner/root/api/client' },
    { name: 'a parameterized prefix', mountPaths: ['/tenants/:tenantId'], prefix: '/tenants/acme/api/client' },
    { name: 'a custom tier prefix', clientBasePath: '/service/v2/client', mountPaths: ['/gateways/:gatewayId'], prefix: '/gateways/main/service/v2/client' },
  ])('preserves exact authentication exemptions with $name', async ({ prefix, ...options }) => {
    const { app, authenticate } = await setup(options)
    authenticate.mockRejectedValue(new ClientAuthError())
    for (const path of ['/auth/login', '/auth/login/', '/auth/refresh', '/auth/refresh/']) {
      const response = await app.request(prefix + path, { method: 'POST', headers: { Authorization: 'Bearer expired' } })
      expect(response.status).toBe(200)
    }
    expect(authenticate).not.toHaveBeenCalled()
    for (const path of ['/auth/userinfo', '/auth/logout', '/auth/login/extra', '/nested/auth/login', '/auth/refresh/extra']) {
      expect((await app.request(prefix + path, { method: 'POST' })).status).toBe(401)
    }
    expect((await app.request(prefix + '/auth/login')).status).toBe(401)
    expect((await app.request(prefix + '/auth/userinfo', { headers: { Authorization: 'Bearer expired' } })).status).toBe(401)
    expect(authenticate).toHaveBeenCalledWith('expired')
  })
})
