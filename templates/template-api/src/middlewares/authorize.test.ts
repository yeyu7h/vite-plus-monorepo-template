import type { AdminBindings } from '@monorepo/server-core'
import { Hono } from 'hono'
import { jwt, sign } from 'hono/jwt'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { enforcerPromise } from '@/lib/services/casbin'
import { authorize } from './authorize'

const sessionState = vi.hoisted(() => ({ roles: [] as string[], effectiveRoles: [] as string[], permissions: [] as string[][], revoked: false }))

vi.mock('@/lib/services/admin-session', () => {
  return {
    getAdminSession: vi.fn<(userId: string, sessionId: string) => Promise<unknown>>(async (userId, sessionId) =>
      sessionState.revoked ? null : { userId, sessionId, roles: sessionState.roles, effectiveRoles: sessionState.effectiveRoles, permissions: sessionState.permissions, groupings: [] },
    ),
  }
})

vi.mock('@/lib/services/casbin', async () => {
  const { newEnforcer, newModel } = await import('casbin')
  return {
    enforcerPromise: newEnforcer(
      newModel(`
[request_definition]
r = sub, obj, act
[policy_definition]
p = sub, obj, act
[role_definition]
g = _, _
[policy_effect]
e = some(where (p.eft == allow))
[matchers]
m = g(r.sub, p.sub) && keyMatch3(r.obj, p.obj) && regexMatch(r.act, p.act)
`),
    ),
  }
})

const secret = 'authorize-test-secret-at-least-32-characters'
const app = new Hono<AdminBindings>()
app.use('*', jwt({ secret, alg: 'HS256' }))
app.use('*', async (c, next) => {
  c.set('tierBasePath', '/api/admin')
  await next()
})
app.use('*', authorize)
app.all('/api/admin/new-feature/:id', (c) => c.json({ ok: true }))

async function request(roles: string[], method = 'GET', sub = 'test-user') {
  sessionState.roles = roles
  sessionState.effectiveRoles = roles
  const token = await sign({ sub, roles, sessionId: 'test-session' }, secret, 'HS256')
  return app.request('/api/admin/new-feature/123', { method, headers: { Authorization: `Bearer ${token}` } })
}

beforeEach(async () => {
  const enforcer = await enforcerPromise
  enforcer.clearPolicy()
  sessionState.roles = []
  sessionState.effectiveRoles = []
  sessionState.permissions = []
  sessionState.revoked = false
})

describe('admin API authorization', () => {
  it.each(['GET', 'POST', 'PATCH', 'DELETE'])('allows admin to access a new %s endpoint without seeded policies', async (method) => {
    const response = await request(['user', 'admin'], method)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
  })

  it.each([{ roles: [] }, { roles: ['user'] }, { roles: ['superadmin'] }])('denies ungranted roles $roles even when the user ID is admin', async ({ roles }) => {
    expect((await request(roles, 'GET', 'admin')).status).toBe(403)
  })

  it('preserves explicit and inherited Casbin permissions and method restrictions', async () => {
    sessionState.permissions = [['reader', '/new-feature/{id}', 'GET']]
    expect((await request(['reader'])).status).toBe(200)
    sessionState.effectiveRoles = ['operator', 'reader']
    expect((await request(['operator'])).status).toBe(200)
    expect((await request(['operator'], 'DELETE')).status).toBe(403)
  })

  it('does not trust a stale admin role in a valid token', async () => {
    const token = await sign({ sub: 'test-user', roles: ['admin'], sessionId: 'test-session' }, secret, 'HS256')
    sessionState.roles = ['reader']
    expect((await app.request('/api/admin/new-feature/123', { headers: { Authorization: `Bearer ${token}` } })).status).toBe(403)
  })

  it('does not inherit policies from a disabled parent role', async () => {
    sessionState.effectiveRoles = ['operator']
    expect((await request(['operator'])).status).toBe(403)
  })

  it('rejects a revoked Redis login session', async () => {
    sessionState.revoked = true
    expect((await request(['admin'])).status).toBe(401)
  })

  it('accepts an existing token without a session ID until it expires', async () => {
    const token = await sign({ sub: 'test-user', roles: ['admin'] }, secret, 'HS256')
    expect((await app.request('/api/admin/new-feature/123', { headers: { Authorization: `Bearer ${token}` } })).status).toBe(200)
  })

  it('still requires a valid JWT before admin authorization', async () => {
    expect((await app.request('/api/admin/new-feature/123')).status).toBe(401)
    const token = await sign({ sub: 'test-user', roles: ['admin'] }, `${secret}-wrong`, 'HS256')
    expect((await app.request('/api/admin/new-feature/123', { headers: { Authorization: `Bearer ${token}` } })).status).toBe(401)
  })
})
