import type { AdminBindings } from '@monorepo/server-core'
import type { MiddlewareHandler } from 'hono'
import { Hono } from 'hono'
import { except } from 'hono/combine'
import { sign } from 'hono/jwt'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import env from '@/env'
import middlewares from './_middleware'

const state = vi.hoisted(() => ({ roles: ['user'], audit: vi.fn<MiddlewareHandler>() }))
vi.mock('@/lib/services/casbin', () => ({ enforcerPromise: Promise.resolve(null) }))
vi.mock('@/lib/services/admin-session', () => ({
  getAdminSession: async () => ({ roles: state.roles, permissions: [] }),
}))
vi.mock('@/middlewares/operation-log', () => ({ operationLog: () => state.audit }))

function createApp(basePath = '/api/admin') {
  const app = new Hono<AdminBindings>({ strict: false })
  app.use('*', async (c, next) => {
    c.set('tierBasePath', basePath)
    await next()
  })
  for (const middleware of middlewares) {
    app.use('*', typeof middleware === 'object' ? except(middleware.except, middleware.handler) : middleware)
  }
  app.all('*', (c) => c.json({ ok: true }))
  return app
}

async function authHeaders() {
  const token = await sign({ sub: 'test-user', roles: state.roles, sessionId: 'test-session' }, env.ADMIN_JWT_SECRET, 'HS256')
  return { Authorization: `Bearer ${token}` }
}

beforeEach(() => {
  state.roles = ['user']
  state.audit.mockReset().mockImplementation(async (_c, next) => {
    await next()
  })
})

describe('admin middleware route exemptions', () => {
  it.each(['GET', 'PATCH', 'DELETE'])('requires API permission for %s on auth-prefixed role IDs', async (method) => {
    const response = await createApp().request('/api/admin/system/roles/auth_reader', { method, headers: await authHeaders() })
    expect(response.status).toBe(403)
  })

  it('audits authorized requests to auth-prefixed business resources', async () => {
    state.roles = ['admin']
    const response = await createApp().request('/api/admin/system/menus/auth', { method: 'PATCH', headers: await authHeaders() })
    expect(response.status).toBe(200)
    expect(state.audit).toHaveBeenCalledOnce()
  })

  it.each(['login', 'refresh', 'challenge', 'redeem'])('allows anonymous POST to the exact %s endpoint, including a trailing slash', async (endpoint) => {
    const response = await createApp().request(`/api/admin/auth/${endpoint}/`, { method: 'POST' })
    expect(response.status).toBe(200)
    expect(state.audit).not.toHaveBeenCalled()
  })

  it.each(['/api/admin/system/auth/login', '/api/admin/author', '/api/admin/auth/userinfo'])('requires a JWT for %s', async (path) => {
    expect((await createApp().request(path, { method: 'POST' })).status).toBe(401)
  })

  it('does not exempt the wrong HTTP method', async () => {
    expect((await createApp().request('/api/admin/auth/login')).status).toBe(401)
  })

  it('keeps authenticated identity routes available without business permissions', async () => {
    const response = await createApp().request('/api/admin/auth/userinfo', { headers: await authHeaders() })
    expect(response.status).toBe(200)
    expect(state.audit).not.toHaveBeenCalled()
  })

  it('uses the configured tier base path without granting similarly named business routes', async () => {
    const app = createApp('/custom/v1/admin')
    expect((await app.request('/custom/v1/admin/auth/login', { method: 'POST' })).status).toBe(200)
    expect((await app.request('/custom/v1/admin/system/roles/auth_reader', { headers: await authHeaders() })).status).toBe(403)
  })
})
