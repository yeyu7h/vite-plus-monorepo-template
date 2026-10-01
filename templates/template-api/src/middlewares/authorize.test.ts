import type { AdminBindings } from '@monorepo/server-core'
import { Hono } from 'hono'
import { jwt, sign } from 'hono/jwt'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { enforcerPromise } from '@/lib/services/casbin'
import { authorize } from './authorize'

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
  const token = await sign({ sub, roles }, secret, 'HS256')
  return app.request('/api/admin/new-feature/123', { method, headers: { Authorization: `Bearer ${token}` } })
}

beforeEach(async () => {
  const enforcer = await enforcerPromise
  enforcer.clearPolicy()
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
    const enforcer = await enforcerPromise
    await enforcer.addPolicy('reader', '/new-feature/{id}', 'GET')
    await enforcer.addGroupingPolicy('operator', 'reader')

    expect((await request(['reader'])).status).toBe(200)
    expect((await request(['operator'])).status).toBe(200)
    expect((await request(['operator'], 'DELETE')).status).toBe(403)
  })

  it('still requires a valid JWT before admin authorization', async () => {
    expect((await app.request('/api/admin/new-feature/123')).status).toBe(401)
    const token = await sign({ sub: 'test-user', roles: ['admin'] }, `${secret}-wrong`, 'HS256')
    expect((await app.request('/api/admin/new-feature/123', { headers: { Authorization: `Bearer ${token}` } })).status).toBe(401)
  })
})
