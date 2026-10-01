import { like } from 'drizzle-orm'
import { jwt } from 'hono/jwt'
import { testClient } from 'hono/testing'
import { afterAll, beforeAll, describe, expect, it } from 'vite-plus/test'

import db from '@/db'
import { systemMenus } from '@/db/schema'
import env from '@/env'
import { Status } from '@/lib/enums'
import { authorize } from '@/middlewares/authorize'
import menusRouter from '@/routes/admin/system/menus/menus.index'
import { HttpStatusCodes } from '@monorepo/server-core'
import { getAuthHeaders } from '~/tests/auth-utils'
import { createTestApp } from '~/tests/utils/test-app'

const prefix = 'test_mgmt_'

function createMenusApp() {
  return createTestApp()
    .use('/system/menus/*', jwt({ secret: env.ADMIN_JWT_SECRET, alg: 'HS256' }))
    .use('/system/menus/*', authorize)
    .route('/', menusRouter)
}

const client = testClient(createMenusApp())

async function cleanup() {
  await db.delete(systemMenus).where(like(systemMenus.id, `${prefix}%`))
}

describe('menu management routes', () => {
  let token: string

  beforeAll(async () => {
    await cleanup()
    const { getAdminToken } = await import('~/tests/auth-utils')
    token = await getAdminToken()
  })

  afterAll(cleanup)

  it('creates restricted menus with admin access and enforces hierarchy rules', async () => {
    const groupId = `${prefix}group`
    const rootId = `${prefix}root`
    const childId = `${prefix}child`

    const groupResponse = await client.system.menus.$post(
      { json: { id: groupId, type: 'group', path: null, title: '测试分组', order: 10, status: Status.ENABLED, accessScope: 'public' } },
      { headers: getAuthHeaders(token) },
    )
    expect(groupResponse.status).toBe(HttpStatusCodes.CREATED)

    const rootResponse = await client.system.menus.$post({ json: { id: rootId, parentId: groupId, type: 'directory', path: `/${rootId}`, title: '测试根菜单' } }, { headers: getAuthHeaders(token) })
    expect(rootResponse.status).toBe(HttpStatusCodes.CREATED)
    if (rootResponse.status === HttpStatusCodes.CREATED) {
      const body = await rootResponse.json()
      expect(body.data).toMatchObject({ accessScope: 'restricted', roleIds: ['admin'] })
    }

    const invalidPublicChild = await client.system.menus.$post(
      { json: { id: childId, parentId: rootId, type: 'menu', path: 'child', title: '公共子菜单', accessScope: 'public' } },
      { headers: getAuthHeaders(token) },
    )
    expect(invalidPublicChild.status).toBe(HttpStatusCodes.BAD_REQUEST)

    const childResponse = await client.system.menus.$post({ json: { id: childId, parentId: rootId, type: 'menu', path: 'child', title: '受限子菜单' } }, { headers: getAuthHeaders(token) })
    expect(childResponse.status).toBe(HttpStatusCodes.CREATED)

    const duplicatePath = await client.system.menus.$post({ json: { id: `${prefix}duplicate`, parentId: rootId, type: 'menu', path: 'child', title: '重复路径' } }, { headers: getAuthHeaders(token) })
    expect(duplicatePath.status).toBe(HttpStatusCodes.CONFLICT)

    const referencedGroupDelete = await client.system.menus[':id'].$delete({ param: { id: groupId } }, { headers: getAuthHeaders(token) })
    expect(referencedGroupDelete.status).toBe(HttpStatusCodes.CONFLICT)

    const deleteResponse = await client.system.menus[':id'].$delete({ param: { id: rootId } }, { headers: getAuthHeaders(token) })
    expect(deleteResponse.status).toBe(HttpStatusCodes.OK)
    if (deleteResponse.status === HttpStatusCodes.OK) expect((await deleteResponse.json()).data.deletedCount).toBe(2)

    const groupDelete = await client.system.menus[':id'].$delete({ param: { id: groupId } }, { headers: getAuthHeaders(token) })
    expect(groupDelete.status).toBe(HttpStatusCodes.OK)
  })
})
