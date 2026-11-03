import { randomUUID } from 'node:crypto'
import { and, eq, inArray } from 'drizzle-orm'
import { afterAll, afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { createClientRouter, createRouter } from '@monorepo/server-core'
import { miniappIdentitySchema } from '@/lib/services/miniapp-auth/config'
import type { MiniappIdentity } from '@/lib/services/miniapp-auth/config'
import db from '@/db'
import { clientUsers, clientUserIdentities, systemUsers, systemUserRoles } from '@/db/schema'
import { hash } from '@node-rs/argon2'
import { except } from 'hono/combine'
import { createAdminRouter } from '@monorepo/server-core'
import adminAuthRouter from '@/routes/admin/auth/auth.index'
import adminUsersRouter from '@/routes/admin/system/users/users.index'
import adminMiddlewares from '@/routes/admin/_middleware'
import { createAdminSession } from '@/lib/services/admin-session'
import { getAdminToken, getAuthHeaders } from '../../../../../tests/auth-utils'
import { Status } from '@/lib/enums'
import { miniappAuth, clientSessions } from '@/lib/services/client-auth'
import { resolveMiniappUser } from '@/lib/services/client-auth/accounts'
import { createClientAuthentication } from '@/middlewares/client-authenticate'
import { onError } from '@/lib/core/stoker/middlewares'
import rootApp from '@/index'
import router from '../auth.index'
import { loginResultSchema, tokenPairSchema } from '../auth.schema'

const appId = 'miniapp-integration-' + randomUUID()
const createdAdminIds = new Set<string>()
const identity = (subject: string, application = appId): MiniappIdentity => miniappIdentitySchema.parse({ provider: 'wechat', appId: application, subjectType: 'open_id', subject })

const app = createClientRouter().basePath('/api/client')
app.use('*', async (c, next) => {
  c.set('tierBasePath', '/api/client')
  return next()
})
app.use('*', createClientAuthentication(clientSessions.authenticate))
app.route('/', router)
app.onError(onError)

const adminApp = createAdminRouter()
adminApp.use('*', async (c, next) => {
  c.set('tierBasePath', '/api/admin')
  return next()
})
for (const middleware of adminMiddlewares) adminApp.use('*', typeof middleware === 'object' ? except(middleware.except, middleware.handler) : middleware)
adminApp.route('/api/admin', adminAuthRouter)
adminApp.route('/api/admin', adminUsersRouter)
adminApp.onError(onError)

async function adminLogin(username: string, password: string) {
  return adminApp.request('/api/admin/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, captchaToken: 'test' }),
  })
}

async function login(subject = randomUUID()) {
  vi.spyOn(miniappAuth, 'verify').mockResolvedValue(identity(subject))
  const response = await app.request('/api/client/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appKey: 'wx-test', code: 'one-use-test-code' }),
  })
  expect(response.status).toBe(200)
  const body = (await response.json()) as { data: unknown }
  return loginResultSchema.parse(body.data)
}

async function refresh(refreshToken: string) {
  return app.request('/api/client/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  })
}

afterEach(() => vi.restoreAllMocks())
afterAll(async () => {
  if (createdAdminIds.size) await db.delete(systemUsers).where(inArray(systemUsers.id, [...createdAdminIds]))
  const rows = await db
    .select({ userId: clientUserIdentities.userId })
    .from(clientUserIdentities)
    .where(inArray(clientUserIdentities.appId, [appId, appId + '-other']))
  if (rows.length)
    await db.delete(clientUsers).where(
      inArray(
        clientUsers.id,
        rows.map(({ userId }) => userId),
      ),
    )
})

describe('mini program login with PostgreSQL and Redis', () => {
  it('registers the login and protected routes in the real application', async () => {
    const request = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ appKey: 'wx-test', code: 'one-use-test-code' }) }
    const unconfigured = await rootApp.request('/api/client/auth/login', request)
    expect(unconfigured.status).toBe(400)
    expect(await unconfigured.json()).toMatchObject({ code: 'APP_NOT_CONFIGURED' })
    expect((await rootApp.request('/api/client/auth/userinfo')).status).toBe(401)

    vi.spyOn(miniappAuth, 'verify').mockResolvedValue(identity(randomUUID()))
    const response = await rootApp.request('/api/client/auth/login', request)
    expect(response.status).toBe(200)
    const result = loginResultSchema.parse(((await response.json()) as { data: unknown }).data)
    const userinfo = await rootApp.request('/api/client/auth/userinfo', { headers: { Authorization: `Bearer ${result.accessToken}` } })
    expect(userinfo.status).toBe(200)
    expect(await userinfo.json()).toEqual({ data: result.user })
  })

  it('supports login and refresh below a parameterized parent while protecting account routes', async () => {
    const mounted = createRouter().route('/tenants/:tenantId', rootApp)
    const prefix = '/tenants/acme/api/client/auth'
    vi.spyOn(miniappAuth, 'verify').mockResolvedValue(identity(randomUUID()))
    const response = await mounted.request(prefix + '/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appKey: 'wx-test', code: 'one-use-test-code' }),
    })
    expect(response.status).toBe(200)
    const result = loginResultSchema.parse(((await response.json()) as { data: unknown }).data)
    const refreshed = await mounted.request(prefix + '/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer expired' },
      body: JSON.stringify({ refreshToken: result.refreshToken }),
    })
    expect(refreshed.status).toBe(200)
    const tokens = tokenPairSchema.parse(((await refreshed.json()) as { data: unknown }).data)
    expect((await mounted.request(prefix + '/userinfo')).status).toBe(401)
    const headers = { Authorization: `Bearer ${tokens.accessToken}` }
    const userinfo = await mounted.request(prefix + '/userinfo', { headers })
    expect(userinfo.status).toBe(200)
    expect(await userinfo.json()).toEqual({ data: result.user })
    expect((await mounted.request(prefix + '/logout', { method: 'POST', headers })).status).toBe(200)
    expect((await mounted.request(prefix + '/userinfo', { headers })).status).toBe(401)
  })

  it('registers without phone or password and repeatedly resolves the same account and public UID', async () => {
    const subject = randomUUID()
    const first = await login(subject)
    const next = await login(subject)
    expect(first.isNewUser).toBe(true)
    expect(next.isNewUser).toBe(false)
    expect(next.user).toEqual(first.user)
    const [row] = await db.select().from(clientUsers).where(eq(clientUsers.id, first.user.id))
    expect(row).toMatchObject({ registerSource: 'wechat' })
    expect(row).not.toHaveProperty('password')
    expect(row).not.toHaveProperty('username')
    expect(row).not.toHaveProperty('builtIn')
    expect(row).not.toHaveProperty('homePath')
    expect(await db.select().from(systemUsers).where(eq(systemUsers.id, first.user.id))).toEqual([])
    expect(first.user).not.toHaveProperty('password')
    expect(first.user.uid).toMatch(/^1\d{8,}$/)
  })

  it('creates exactly one account under concurrent first logins', async () => {
    const platformIdentity = identity(randomUUID())
    const results = await Promise.all(Array.from({ length: 8 }, () => resolveMiniappUser(platformIdentity)))
    expect(new Set(results.map(({ user }) => user.id)).size).toBe(1)
    expect(new Set(results.map(({ user }) => user.uid)).size).toBe(1)
    expect(results.filter(({ isNewUser }) => isNewUser)).toHaveLength(1)
    const identities = await db
      .select()
      .from(clientUserIdentities)
      .where(and(eq(clientUserIdentities.appId, appId), eq(clientUserIdentities.subject, platformIdentity.subject)))
    expect(identities).toHaveLength(1)
  })

  it('allocates unique UIDs for different business users under concurrency', async () => {
    const results = await Promise.all(Array.from({ length: 12 }, () => resolveMiniappUser(identity(randomUUID()))))
    expect(new Set(results.map(({ user }) => user.uid)).size).toBe(12)
    expect(new Set(results.map(({ user }) => user.id)).size).toBe(12)
  })

  it('scopes identities to AppID without automatically merging UnionIDs', async () => {
    const subject = randomUUID()
    const first = await resolveMiniappUser({ ...identity(subject), unionId: 'shared-union' })
    const second = await resolveMiniappUser({ ...identity(subject, appId + '-other'), unionId: 'shared-union' })
    expect(new Set([first.user.id, second.user.id]).size).toBe(2)
  })

  it('keeps current userinfo private and revokes access immediately on logout', async () => {
    const result = await login()
    const headers = { Authorization: `Bearer ${result.accessToken}` }
    const response = await app.request('/api/client/auth/userinfo', { headers })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data: result.user })
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect((await app.request('/api/client/auth/logout', { method: 'POST', headers })).status).toBe(200)
    expect((await app.request('/api/client/auth/userinfo', { headers })).status).toBe(401)
    expect((await refresh(result.refreshToken)).status).toBe(401)
  })

  it('rotates refresh tokens atomically with real Redis', async () => {
    const result = await login()
    const responses = await Promise.all([refresh(result.refreshToken), refresh(result.refreshToken)])
    expect(responses.map(({ status }) => status).sort((a, b) => a - b)).toEqual([200, 401])
    const winner = responses.find(({ status }) => status === 200)!
    const body = (await winner.json()) as { data: unknown }
    const next = tokenPairSchema.parse(body.data)
    expect(next.refreshToken).not.toBe(result.refreshToken)
    expect((await refresh(result.refreshToken)).status).toBe(401)
    expect((await refresh(next.refreshToken)).status).toBe(200)
  })

  it('rejects a disabled business account on access, refresh, and platform login', async () => {
    const subject = randomUUID()
    const result = await login(subject)
    await db.update(clientUsers).set({ status: Status.DISABLED }).where(eq(clientUsers.id, result.user.id))
    expect((await app.request('/api/client/auth/userinfo', { headers: { Authorization: `Bearer ${result.accessToken}` } })).status).toBe(403)
    expect((await refresh(result.refreshToken)).status).toBe(403)
    await expect(resolveMiniappUser(identity(subject))).rejects.toMatchObject({ reason: 'disabled' })
  })

  it('rejects client-supplied identity fields before contacting the platform', async () => {
    const verify = vi.spyOn(miniappAuth, 'verify')
    const response = await app.request('/api/client/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appKey: 'wx-test', code: 'code', userId: randomUUID(), openid: 'forged', appSecret: 'forged' }),
    })
    expect(response.status).toBe(422)
    expect(verify).not.toHaveBeenCalled()
  })

  it('cannot grant admin roles or create admin sessions for a business-only account', async () => {
    const result = await login()
    await expect(db.insert(systemUserRoles).values({ userId: result.user.id, roleId: 'user' })).rejects.toMatchObject({ cause: { code: '23503' } })
    await expect(createAdminSession(result.user.id)).rejects.toThrow('User is no longer active')
    const response = await adminApp.request(`/api/admin/system/users/${result.user.id}`, {
      method: 'PATCH',
      headers: { ...getAuthHeaders(await getAdminToken()), 'Content-Type': 'application/json' },
      body: JSON.stringify({ roleIds: ['admin'] }),
    })
    expect(response.status).toBe(404)
    expect((await adminLogin(result.user.uid, 'testPass123')).status).toBe(401)
  })

  it('rejects business access and refresh tokens at administration endpoints', async () => {
    const result = await login()
    for (const path of ['/auth/userinfo', '/auth/access', '/auth/permissions', '/system/users']) {
      expect((await adminApp.request('/api/admin' + path, { headers: { Authorization: `Bearer ${result.accessToken}` } })).status).toBe(401)
    }
    const response = await adminApp.request('/api/admin/auth/refresh', { method: 'POST', headers: { Cookie: `refreshToken=${result.refreshToken}` } })
    expect(response.status).toBe(401)
  })

  it('rejects admin access and refresh tokens at business endpoints', async () => {
    expect((await app.request('/api/client/auth/userinfo', { headers: getAuthHeaders(await getAdminToken()) })).status).toBe(401)
    const response = await adminLogin('admin', '123456')
    expect(response.status).toBe(200)
    const cookie = response.headers.get('Set-Cookie')?.split(';')[0]
    if (!cookie) throw new Error('Missing admin refresh cookie')
    const adminRefreshToken = decodeURIComponent(cookie.slice(cookie.indexOf('=') + 1))
    expect((await refresh(adminRefreshToken)).status).toBe(401)
  })

  it('keeps accounts independent even if their internal UUIDs happen to be equal', async () => {
    const result = await login()
    const username = 'iso' + randomUUID().slice(0, 8)
    await db.insert(systemUsers).values({ id: result.user.id, username, password: await hash('testPass123'), nickName: 'Admin isolation fixture' })
    createdAdminIds.add(result.user.id)
    await db.insert(systemUserRoles).values({ userId: result.user.id, roleId: 'user' })
    await db.update(systemUsers).set({ status: Status.DISABLED }).where(eq(systemUsers.id, result.user.id))
    expect((await app.request('/api/client/auth/userinfo', { headers: { Authorization: `Bearer ${result.accessToken}` } })).status).toBe(200)
    await db.update(systemUsers).set({ status: Status.ENABLED }).where(eq(systemUsers.id, result.user.id))
    await db.update(clientUsers).set({ status: Status.DISABLED }).where(eq(clientUsers.id, result.user.id))
    expect((await adminLogin(username, 'testPass123')).status).toBe(200)
    expect((await app.request('/api/client/auth/userinfo', { headers: { Authorization: `Bearer ${result.accessToken}` } })).status).toBe(403)
  })
})
