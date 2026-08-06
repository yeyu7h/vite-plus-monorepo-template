import { hash } from '@node-rs/argon2'
import { eq, inArray } from 'drizzle-orm'
import { testClient } from 'hono/testing'
import { afterAll, beforeAll, describe, expect, it } from 'vite-plus/test'

import db from '@/db'
import { systemMenuRoles, systemMenus, systemRoles, systemUsers } from '@/db/schema'
import env from '@/env'
import { HttpStatusCodes } from '@monorepo/server-core'
import { Status } from '@/lib/enums'
import { generateAccessToken, logout as cleanupRefreshTokens } from '@/routes/admin/auth/auth.helpers'
import { setRoleParents } from '@/routes/admin/system/roles/roles.helpers'
import authRouter from '@/routes/admin/auth/auth.index'
import { createTestApp } from '~/tests/utils/test-app'
import { reloadCasbinPolicy } from '~/tests/utils/casbin'

if (env.NODE_ENV !== 'test') {
  throw new Error("NODE_ENV must be 'test'")
}

// ===== Test app / 测试应用 =====
function createAuthApp() {
  return createTestApp().route('/', authRouter)
}

const client = testClient(createAuthApp())

// ===== Utility functions / 工具函数 =====
/** Extract refreshToken cookie value from response headers / 从响应头提取 refreshToken cookie 值 */
function extractRefreshToken(response: { headers: Headers }): string | null {
  const setCookie = response.headers.get('set-cookie')
  if (!setCookie) return null

  const match = setCookie.match(/refreshToken=([^;]+)/)
  return match ? match[1] : null
}

/** Login and return accessToken and refreshToken / 登录并返回 accessToken 和 refreshToken */
async function loginAs(credentials: { username: string; password: string }) {
  const response = await client.auth.login.$post({
    json: { ...credentials, captchaToken: 'test' },
  })
  const json = await response.json()
  const refreshToken = extractRefreshToken(response)
  return {
    response,
    accessToken: (json as any).data?.accessToken as string,
    refreshToken,
  }
}

// ===== Test constants / 测试常量 =====
const ADMIN_CREDENTIALS = { username: 'admin', password: '123456' }
const USER_CREDENTIALS = { username: 'user', password: '123456' }
const DISABLED_USERNAME = 'disabled_auth_check'

// ===== Test body / 测试主体 =====
describe('auth routes', () => {
  beforeAll(async () => {
    // Create disabled test user / 创建禁用测试用户
    const passwordHash = await hash('123456')
    await db
      .insert(systemUsers)
      .values({
        username: DISABLED_USERNAME,
        password: passwordHash,
        nickName: '禁用测试用户',
        status: Status.DISABLED,
        builtIn: false,
      })
      .onConflictDoNothing()
  })

  afterAll(async () => {
    // Clean up refresh tokens in Redis / 清理 Redis 中的 refresh token
    const adminUser = await db.query.systemUsers.findFirst({
      where: { username: 'admin' },
      columns: { id: true },
    })
    const regularUser = await db.query.systemUsers.findFirst({
      where: { username: 'user' },
      columns: { id: true },
    })
    if (adminUser) await cleanupRefreshTokens(adminUser.id)
    if (regularUser) await cleanupRefreshTokens(regularUser.id)

    // Clean up disabled test user / 清理禁用测试用户
    await db.delete(systemUsers).where(eq(systemUsers.username, DISABLED_USERNAME))
  })

  // ===== POST /auth/login =====
  describe('POST /auth/login', () => {
    it('should login successfully with correct credentials', async () => {
      const { response, accessToken } = await loginAs(ADMIN_CREDENTIALS)

      expect(response.status).toBe(HttpStatusCodes.OK)
      expect(accessToken).toBeDefined()
      expect(typeof accessToken).toBe('string')
      expect(accessToken.length).toBeGreaterThan(0)
    })

    it('should set httpOnly refreshToken cookie on login', async () => {
      const { response, refreshToken } = await loginAs(ADMIN_CREDENTIALS)

      expect(response.status).toBe(HttpStatusCodes.OK)
      expect(refreshToken).toBeDefined()

      const setCookie = response.headers.get('set-cookie')!

      expect(setCookie).toContain('refreshToken=')
      expect(setCookie.toLowerCase()).toContain('httponly')
      expect(setCookie.toLowerCase()).toContain('samesite=strict')
      expect(setCookie.toLowerCase()).toContain('path=/')
    })

    it('should return 401 for wrong password', async () => {
      const response = await client.auth.login.$post({
        json: { username: 'admin', password: 'wrongpassword', captchaToken: 'test' },
      })

      expect(response.status).toBe(HttpStatusCodes.UNAUTHORIZED)

      const json = await response.json()

      expect((json as any).message).toContain('用户名或密码错误')
    })

    it('should return 401 for non-existent username', async () => {
      const response = await client.auth.login.$post({
        json: { username: 'nonexistent_user_xyz', password: '123456', captchaToken: 'test' },
      })

      expect(response.status).toBe(HttpStatusCodes.UNAUTHORIZED)

      const json = await response.json()

      expect((json as any).message).toContain('用户名或密码错误')
    })

    it('should return 403 for disabled user', async () => {
      const response = await client.auth.login.$post({
        json: { username: DISABLED_USERNAME, password: '123456', captchaToken: 'test' },
      })

      expect(response.status).toBe(HttpStatusCodes.FORBIDDEN)

      const json = await response.json()

      expect((json as any).message).toContain('用户已被禁用')
    })
  })

  // ===== POST /auth/refresh =====
  describe('POST /auth/refresh', () => {
    it('should refresh access token with valid refresh token cookie', async () => {
      const { refreshToken } = await loginAs(ADMIN_CREDENTIALS)

      expect(refreshToken).toBeDefined()

      const response = await client.auth.refresh.$post({}, { headers: { Cookie: `refreshToken=${refreshToken}` } })

      expect(response.status).toBe(HttpStatusCodes.OK)

      const json = await response.json()

      expect((json as any).data.accessToken).toBeDefined()
      expect(typeof (json as any).data.accessToken).toBe('string')
    })

    it('should rotate refresh token on each refresh', async () => {
      const { refreshToken: oldRefreshToken } = await loginAs(ADMIN_CREDENTIALS)

      expect(oldRefreshToken).toBeDefined()

      const response = await client.auth.refresh.$post({}, { headers: { Cookie: `refreshToken=${oldRefreshToken}` } })

      expect(response.status).toBe(HttpStatusCodes.OK)

      const newRefreshToken = extractRefreshToken(response)

      expect(newRefreshToken).toBeDefined()
      expect(newRefreshToken).not.toBe(oldRefreshToken)
    })

    it('should return 401 when no refresh token cookie present', async () => {
      const response = await client.auth.refresh.$post({})

      expect(response.status).toBe(HttpStatusCodes.UNAUTHORIZED)

      const json = await response.json()

      expect((json as any).message).toContain('刷新令牌不存在')
    })

    it('should return 401 with invalid refresh token', async () => {
      const response = await client.auth.refresh.$post({}, { headers: { Cookie: 'refreshToken=invalid-token-value' } })

      expect(response.status).toBe(HttpStatusCodes.UNAUTHORIZED)
    })

    it('should return 401 with revoked refresh token', async () => {
      // Login to get refreshToken / 登录获取 refreshToken
      const { accessToken, refreshToken } = await loginAs(ADMIN_CREDENTIALS)

      expect(refreshToken).toBeDefined()

      // Logout, revoke all refresh tokens / 退出登录，吊销所有 refresh token
      await client.auth.logout.$post({}, { headers: { Authorization: `Bearer ${accessToken}` } })

      // Attempt to refresh with revoked refreshToken / 使用已吊销的 refreshToken 尝试刷新
      const response = await client.auth.refresh.$post({}, { headers: { Cookie: `refreshToken=${refreshToken}` } })

      expect(response.status).toBe(HttpStatusCodes.UNAUTHORIZED)
    })
  })

  // ===== POST /auth/logout =====
  describe('POST /auth/logout', () => {
    it('should logout successfully with valid JWT', async () => {
      const { accessToken } = await loginAs(ADMIN_CREDENTIALS)

      const response = await client.auth.logout.$post({}, { headers: { Authorization: `Bearer ${accessToken}` } })

      expect(response.status).toBe(HttpStatusCodes.OK)

      const json = await response.json()

      expect((json as any).data).toEqual({})
    })

    it('should delete refreshToken cookie on logout', async () => {
      const { accessToken } = await loginAs(ADMIN_CREDENTIALS)

      const response = await client.auth.logout.$post({}, { headers: { Authorization: `Bearer ${accessToken}` } })

      expect(response.status).toBe(HttpStatusCodes.OK)

      const setCookie = response.headers.get('set-cookie')

      expect(setCookie).toBeDefined()
      // Cookie value is empty or Max-Age=0 when deleted / 删除 cookie 时值为空或 Max-Age=0
      expect(setCookie).toContain('refreshToken=')
    })

    it('should revoke all refresh tokens (subsequent refresh fails)', async () => {
      // Login twice to generate two refreshTokens / 登录两次生成两个 refreshToken
      const login1 = await loginAs(ADMIN_CREDENTIALS)
      const login2 = await loginAs(ADMIN_CREDENTIALS)

      // Logout using the first login's accessToken / 使用第一次登录的 accessToken 退出
      await client.auth.logout.$post({}, { headers: { Authorization: `Bearer ${login1.accessToken}` } })

      // Both old refreshTokens should be invalidated / 两个旧 refreshToken 都应该失效
      const refresh1 = await client.auth.refresh.$post({}, { headers: { Cookie: `refreshToken=${login1.refreshToken}` } })

      expect(refresh1.status).toBe(HttpStatusCodes.UNAUTHORIZED)

      const refresh2 = await client.auth.refresh.$post({}, { headers: { Cookie: `refreshToken=${login2.refreshToken}` } })

      expect(refresh2.status).toBe(HttpStatusCodes.UNAUTHORIZED)
    })

    it('should return 401 without JWT', async () => {
      const response = await client.auth.logout.$post({})

      expect(response.status).toBe(HttpStatusCodes.UNAUTHORIZED)
    })
  })

  // ===== GET /auth/userinfo =====
  describe('GET /auth/userinfo', () => {
    it('should return current admin user info', async () => {
      const { accessToken } = await loginAs(ADMIN_CREDENTIALS)

      const response = await client.auth.userinfo.$get({}, { headers: { Authorization: `Bearer ${accessToken}` } })

      expect(response.status).toBe(HttpStatusCodes.OK)

      const json = await response.json()
      const data = (json as any).data

      expect(data.username).toBe('admin')
      expect(data.id).toBeDefined()
      expect(data.nickName).toBeDefined()
      expect(data.roles).toBeDefined()
      expect(Array.isArray(data.roles)).toBe(true)
      expect(data.roles).toContain('admin')
    })

    it('should return current regular user info', async () => {
      const { accessToken } = await loginAs(USER_CREDENTIALS)

      const response = await client.auth.userinfo.$get({}, { headers: { Authorization: `Bearer ${accessToken}` } })

      expect(response.status).toBe(HttpStatusCodes.OK)

      const json = await response.json()
      const data = (json as any).data

      expect(data.username).toBe('user')
      expect(data.roles).toBeDefined()
      expect(Array.isArray(data.roles)).toBe(true)
    })

    it('should not include password in response', async () => {
      const { accessToken } = await loginAs(ADMIN_CREDENTIALS)

      const response = await client.auth.userinfo.$get({}, { headers: { Authorization: `Bearer ${accessToken}` } })

      expect(response.status).toBe(HttpStatusCodes.OK)

      const json = await response.json()

      expect((json as any).data).not.toHaveProperty('password')
    })

    it('should return 401 without JWT', async () => {
      const response = await client.auth.userinfo.$get({})

      expect(response.status).toBe(HttpStatusCodes.UNAUTHORIZED)
    })
  })

  // ===== GET /auth/access =====
  describe('GET /auth/access', () => {
    it('should return the full menu tree and button permission codes for admin', async () => {
      const { accessToken } = await loginAs(ADMIN_CREDENTIALS)

      const response = await client.auth.access.$get({}, { headers: { Authorization: `Bearer ${accessToken}` } })

      expect(response.status).toBe(HttpStatusCodes.OK)

      if (response.status === HttpStatusCodes.OK) {
        const json = await response.json()
        const data = (json as any).data
        const menuIds = collectMenuIds(data.menus)

        expect(menuIds).toContain('system')
        expect(menuIds).toContain('docs-vite-plus')
        expect(menuIds).not.toContain('system-role-create')
        expect(data.permissionCodes).toContain('system:role:create')
      }
    })

    it('should return public menus and the visible forbidden menu for a regular user', async () => {
      const { accessToken } = await loginAs(USER_CREDENTIALS)

      const response = await client.auth.access.$get({}, { headers: { Authorization: `Bearer ${accessToken}` } })

      expect(response.status).toBe(HttpStatusCodes.OK)

      if (response.status === HttpStatusCodes.OK) {
        const json = await response.json()
        const data = (json as any).data
        const menuIds = collectMenuIds(data.menus)

        expect(menuIds).toContain('access-menu-visible-403')
        expect(menuIds).not.toContain('system')
        expect(menuIds).not.toContain('system-role')
        expect(data.permissionCodes).not.toContain('system:role:create')
      }
    })

    it('should require authentication', async () => {
      const response = await client.auth.access.$get({})

      expect(response.status).toBe(HttpStatusCodes.UNAUTHORIZED)
    })

    it('should include menus and permissions inherited through Casbin roles', async () => {
      const suffix = `${Date.now()}`
      const parentRoleId = `access_parent_${suffix}`
      const childRoleId = `access_child_${suffix}`
      const rootMenuId = `access_root_${suffix}`
      const pageMenuId = `access_page_${suffix}`
      const buttonMenuId = `access_button_${suffix}`
      const menuIds = [rootMenuId, pageMenuId, buttonMenuId]
      const roleIds = [parentRoleId, childRoleId]

      const adminUser = await db.query.systemUsers.findFirst({ where: { username: 'admin' }, columns: { id: true } })
      expect(adminUser).toBeDefined()

      await db.insert(systemRoles).values([
        { id: parentRoleId, name: 'Access Parent', status: Status.ENABLED },
        { id: childRoleId, name: 'Access Child', status: Status.ENABLED },
      ])
      await db.insert(systemMenus).values([
        { id: rootMenuId, path: `/access-inherited/${suffix}`, title: '继承目录', type: 'directory', status: Status.ENABLED },
        { id: pageMenuId, parentId: rootMenuId, path: 'page', title: '继承页面', type: 'menu', status: Status.ENABLED },
        { id: buttonMenuId, parentId: pageMenuId, path: 'create', title: '继承按钮', type: 'button', permissionCode: `access:${suffix}:create`, status: Status.ENABLED },
      ])
      await db.insert(systemMenuRoles).values(menuIds.map((menuId) => ({ menuId, roleId: parentRoleId })))
      await setRoleParents(childRoleId, [parentRoleId])

      try {
        const accessToken = await generateAccessToken({ id: adminUser!.id, roles: [childRoleId] })
        const response = await client.auth.access.$get({}, { headers: { Authorization: `Bearer ${accessToken}` } })

        expect(response.status).toBe(HttpStatusCodes.OK)

        if (response.status === HttpStatusCodes.OK) {
          const json = await response.json()
          const data = (json as any).data
          const menuIdsFromResponse = collectMenuIds(data.menus)

          expect(menuIdsFromResponse).toContain(rootMenuId)
          expect(menuIdsFromResponse).toContain(pageMenuId)
          expect(menuIdsFromResponse).not.toContain(buttonMenuId)
          expect(data.permissionCodes).toContain(`access:${suffix}:create`)
        }
      } finally {
        await setRoleParents(childRoleId, [])
        await db.delete(systemMenuRoles).where(inArray(systemMenuRoles.menuId, menuIds))
        await db.delete(systemMenus).where(inArray(systemMenus.id, menuIds))
        await db.delete(systemRoles).where(inArray(systemRoles.id, roleIds))
        await reloadCasbinPolicy()
      }
    })
  })

  // ===== GET /auth/permissions =====
  describe('GET /auth/permissions', () => {
    it('should return permissions for admin user', async () => {
      const { accessToken } = await loginAs(ADMIN_CREDENTIALS)

      const response = await client.auth.permissions.$get({}, { headers: { Authorization: `Bearer ${accessToken}` } })

      expect(response.status).toBe(HttpStatusCodes.OK)

      const json = await response.json()
      const data = (json as any).data

      expect(data.permissions).toBeDefined()
      expect(Array.isArray(data.permissions)).toBe(true)
      expect(data.groupings).toBeDefined()
      expect(Array.isArray(data.groupings)).toBe(true)
    })

    it('should return permissions for regular user', async () => {
      const { accessToken } = await loginAs(USER_CREDENTIALS)

      const response = await client.auth.permissions.$get({}, { headers: { Authorization: `Bearer ${accessToken}` } })

      expect(response.status).toBe(HttpStatusCodes.OK)

      const json = await response.json()
      const data = (json as any).data

      expect(data.permissions).toBeDefined()
      expect(Array.isArray(data.permissions)).toBe(true)
      expect(data.groupings).toBeDefined()
      expect(Array.isArray(data.groupings)).toBe(true)
    })

    it('should return 401 without JWT', async () => {
      const response = await client.auth.permissions.$get({})

      expect(response.status).toBe(HttpStatusCodes.UNAUTHORIZED)
    })
  })
})

function collectMenuIds(menus: unknown): string[] {
  if (!Array.isArray(menus)) return []

  return menus.flatMap((menu) => {
    if (typeof menu !== 'object' || menu === null) return []
    const record = menu as { children?: unknown; id?: unknown }
    return [...(typeof record.id === 'string' ? [record.id] : []), ...collectMenuIds(record.children)]
  })
}
