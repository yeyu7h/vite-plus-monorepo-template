import { eq, like } from 'drizzle-orm'
import { jwt } from 'hono/jwt'

import { afterAll, beforeAll, describe, expect, it } from 'vite-plus/test'

import db from '@/db'
import { systemMenuGroups, systemMenus } from '@/db/schema'
import env from '@/env'
import { HttpStatusCodes } from '@monorepo/server-core'
import { enforcerPromise } from '@/lib/services/casbin'
import { authorize } from '@/middlewares/authorize'
import menuGroupsRouter from '@/routes/admin/system/menu-groups/menu-groups.index'
import menusRouter from '@/routes/admin/system/menus/menus.index'
import { getAdminToken, getAuthHeaders } from '~/tests/auth-utils'
import { createTestApp } from '~/tests/utils/test-app'

if (env.NODE_ENV !== 'test') throw new Error("NODE_ENV must be 'test'")

const app = createTestApp()
  .use('/system/*', jwt({ secret: env.ADMIN_JWT_SECRET, alg: 'HS256' }))
  .use('/system/*', authorize)
  .route('/', menuGroupsRouter)
  .route('/', menusRouter)

let headers: Record<string, string>

async function request(path: string, method: string, body?: unknown) {
  return app.request(path, {
    method,
    headers: { ...headers, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}

async function cleanup() {
  const rows = await db.select({ id: systemMenus.id }).from(systemMenus).where(like(systemMenus.title, '测试菜单%'))
  for (const row of rows.reverse()) {
    await db.delete(systemMenus).where(eq(systemMenus.id, row.id))
  }
  await db.delete(systemMenuGroups).where(like(systemMenuGroups.name, '测试分组%'))
  const enforcer = await enforcerPromise
  await enforcer.removePolicy('user', '/test/menu-action', 'POST')
}

describe('system menu management', () => {
  beforeAll(async () => {
    headers = getAuthHeaders(await getAdminToken())
    await cleanup()
  })

  afterAll(cleanup)

  it('creates role-independent button definitions and preserves role-managed Casbin policies', async () => {
    const groupResponse = await request('/system/menu-groups', 'POST', { name: '测试分组菜单', order: 90 })
    expect(groupResponse.status).toBe(HttpStatusCodes.CREATED)
    const group = (await groupResponse.json()) as { data: { id: string } }

    const pageResponse = await request('/system/menus', 'POST', {
      type: 'PAGE',
      title: '测试菜单页面',
      path: '/test/menu-page',
      permissionCode: 'test:menu:view',
      groupId: group.data.id,
      order: 10,
    })
    expect(pageResponse.status).toBe(HttpStatusCodes.CREATED)
    const page = (await pageResponse.json()) as { data: { id: string; permissionCode: string | null } }
    expect(page.data.permissionCode).toBe('test:menu:view')

    const buttonResponse = await request(`/system/menus/${page.data.id}/children`, 'POST', {
      type: 'BUTTON',
      title: '测试菜单按钮',
      permissionCode: 'test:menu:create',
      resource: '/test/menu-action',
      action: 'POST',
      order: 10,
    })
    expect(buttonResponse.status).toBe(HttpStatusCodes.CREATED)
    const button = (await buttonResponse.json()) as { data: { id: string } }
    expect(await (await enforcerPromise).enforce('user', '/test/menu-action', 'POST')).toBe(false)

    await (await enforcerPromise).addPolicy('user', '/test/menu-action', 'POST')

    const blockedPageDelete = await request(`/system/menus/${page.data.id}`, 'DELETE')
    expect(blockedPageDelete.status).toBe(HttpStatusCodes.CONFLICT)
    const blockedGroupDelete = await request(`/system/menu-groups/${group.data.id}`, 'DELETE')
    expect(blockedGroupDelete.status).toBe(HttpStatusCodes.CONFLICT)

    expect((await request(`/system/menus/${button.data.id}`, 'DELETE')).status).toBe(HttpStatusCodes.OK)
    expect(await (await enforcerPromise).enforce('user', '/test/menu-action', 'POST')).toBe(true)
    expect((await request(`/system/menus/${page.data.id}`, 'DELETE')).status).toBe(HttpStatusCodes.OK)
    expect((await request(`/system/menu-groups/${group.data.id}`, 'DELETE')).status).toBe(HttpStatusCodes.OK)
  })
})
