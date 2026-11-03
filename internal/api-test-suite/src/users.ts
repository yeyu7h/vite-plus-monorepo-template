import { HttpStatusCodes } from '@monorepo/server-core'
import { afterAll, beforeAll, describe, expect, it } from 'vite-plus/test'
import { createAdminClient, readResponse, type AdminRouteTestContext } from './admin-client'

type User = {
  id: string
  username: string
  nickName: string
  avatar: string | null
  homePath: string | null
  roles?: { id: string }[]
  builtIn: boolean | null
  createdAt: string | null
}
type Session = { sessionId: string; roles: string[] }
type UserRouteTestContext = AdminRouteTestContext & {
  createAdminSession: (userId: string) => Promise<Session>
  getAdminSession: (userId: string, sessionId: string) => Promise<Session | null>
  revokeAdminSession: (userId: string, sessionId: string) => Promise<void>
}

export function defineUserRouteTests({ app, getAdminToken, getUserToken, enforcerPromise, cleanup, createAdminSession, getAdminSession, revokeAdminSession }: UserRouteTestContext) {
  const Status = { ENABLED: 'ENABLED', DISABLED: 'DISABLED' } as const
  const testUsername = `t${crypto.randomUUID().slice(0, 4)}`
  const filterUsername = `${testUsername}_filter`
  const testUser = { username: testUsername, password: 'test123456', nickName: '测试用户', status: Status.ENABLED, avatar: 'https://example.com/avatar.png' }
  let adminToken: string
  let userToken: string
  const request = createAdminClient(app, '/system/users', () => adminToken)
  async function getBuiltInUserId() {
    const response = await request('GET', '', { query: { filters: JSON.stringify([{ field: 'username', operator: 'eq', value: 'admin' }]) } })
    expect(response.status).toBe(HttpStatusCodes.OK)
    const { data } = await readResponse<User[]>(response)
    expect(data).toEqual([expect.objectContaining({ username: 'admin', builtIn: true })])
    return data[0].id
  }

  describe('system user routes', () => {
    beforeAll(async () => {
      await cleanup(testUsername)

      adminToken = await getAdminToken()
      userToken = await getUserToken()
      const response = await request('POST', '', { json: { ...testUser, username: filterUsername } })
      expect(response.status).toBe(HttpStatusCodes.CREATED)
    })

    afterAll(async () => {
      await cleanup(testUsername)
    })

    describe('authentication & authorization', () => {
      it('should allow authenticated admin requests', async () => {
        const response = await request('GET', '', { query: {} })

        expect(response.status).toBe(HttpStatusCodes.OK)
      })

      it('should deny access with user token (no admin permissions)', async () => {
        const response = await request('GET', '', { query: {} }, userToken)

        expect(response.status).toBe(HttpStatusCodes.FORBIDDEN)
      })

      it('should require authentication', async () => {
        const response = await request('GET', '', { query: {} }, null)

        expect(response.status).toBe(HttpStatusCodes.UNAUTHORIZED)
      })

      it('should reject role assignment from a non-admin with the create API permission', async () => {
        const enforcer = await enforcerPromise
        const added = await enforcer.addPolicy('user', '/system/users', 'POST')
        try {
          const response = await request('POST', '', { json: { ...testUser, username: `${testUsername}_delegated`, roleIds: ['admin'] } }, userToken)
          expect(response.status).toBe(HttpStatusCodes.FORBIDDEN)
        } finally {
          if (added) await enforcer.removePolicy('user', '/system/users', 'POST')
        }
      })
    })

    describe('get /system/user - list users', () => {
      it('should validate pagination parameters', async () => {
        const response = await request('GET', '', { query: { current: 'invalid', pageSize: -1 } })

        expect(response.status).toBe(HttpStatusCodes.UNPROCESSABLE_ENTITY)
      })

      it('should list users with default pagination', async () => {
        const response = await request('GET', '', { query: {} })

        expect(response.status).toBe(HttpStatusCodes.OK)

        const responseJson = await readResponse<User[]>(response)

        expect(responseJson.data).toBeDefined()
        expect(Array.isArray(responseJson.data)).toBe(true)
      })

      it('should support filtering by username', async () => {
        const response = await request('GET', '', { query: { filters: JSON.stringify([{ field: 'username', operator: 'contains', value: filterUsername }]) } })
        expect(response.status).toBe(HttpStatusCodes.OK)
        const { data } = await readResponse<User[]>(response)
        expect(data).toEqual([expect.objectContaining({ username: filterUsername })])
      })

      it('should always place the built-in admin first and sort regular users', async () => {
        const response = await request('GET', '', { query: { sorters: JSON.stringify([{ field: 'createdAt', order: 'desc' }]) } })
        expect(response.status).toBe(HttpStatusCodes.OK)
        const { data } = await readResponse<User[]>(response)
        const items = data
        expect(items[0]).toMatchObject({ username: 'admin', builtIn: true })
        const regularUsers = items.filter(({ builtIn }) => !builtIn)
        expect(regularUsers.length).toBeGreaterThanOrEqual(2)
        const timestamps = regularUsers.map(({ createdAt }) => {
          expect(createdAt).toBeTypeOf('string')
          return new Date(createdAt!).getTime()
        })
        expect(timestamps).toEqual([...timestamps].sort((left, right) => right - left))
      })
    })

    describe('post /system/user - create user', () => {
      it('should validate required fields', async () => {
        const response = await request('POST', '', { json: { username: `${testUsername}_required` } })

        expect(response.status).toBe(HttpStatusCodes.UNPROCESSABLE_ENTITY)

        const responseJson = (await readResponse<User>(response)) as { message?: string; error?: { issues?: unknown } }

        expect(responseJson.error?.issues).toBeDefined()
      })

      it.each(['ab', 'test-user!'])('should reject invalid username %j', async (username) => {
        const response = await request('POST', '', { json: { ...testUser, username } })
        expect(response.status).toBe(HttpStatusCodes.UNPROCESSABLE_ENTITY)
      })

      it('should validate password length (6-20 chars)', async () => {
        const response = await request('POST', '', { json: { ...testUser, username: `${testUsername}_pwd`, password: '12345' } })

        expect(response.status).toBe(HttpStatusCodes.UNPROCESSABLE_ENTITY)
      })

      it('should create a new user', async () => {
        const newUsername = `${testUsername}_create`
        const response = await request('POST', '', { json: { ...testUser, username: newUsername } })

        expect(response.status).toBe(HttpStatusCodes.CREATED)

        const responseJson = await readResponse<User>(response)

        expect(responseJson.data.username).toBe(newUsername)
        expect(responseJson.data.nickName).toBe(testUser.nickName)
        expect(responseJson.data).not.toHaveProperty('password') // Password should not be returned / 不应返回密码
      })

      it('should return 409 for duplicate username', async () => {
        const duplicateUsername = `${testUsername}_duplicate`

        const response1 = await request('POST', '', { json: { ...testUser, username: duplicateUsername } })

        expect(response1.status).toBe(HttpStatusCodes.CREATED)

        const response2 = await request('POST', '', { json: { ...testUser, username: duplicateUsername } })

        expect(response2.status).toBe(HttpStatusCodes.CONFLICT)

        const json = (await readResponse<User>(response2)) as { message: string }

        expect(json.message).toContain('已存在')
      })
    })

    describe('get /system/user/{id} - get user', () => {
      let userId: string

      beforeAll(async () => {
        const response = await request('POST', '', { json: { ...testUser, username: `${testUsername}_gettest` } })

        expect(response.status).toBe(HttpStatusCodes.CREATED)

        const responseJson = await readResponse<User>(response)
        userId = responseJson.data.id
      })

      it('should validate UUID format', async () => {
        const response = await request('GET', '/:id', { param: { id: 'invalid-uuid' } })

        expect(response.status).toBe(HttpStatusCodes.UNPROCESSABLE_ENTITY)
      })

      it('should return 404 for non-existent user', async () => {
        const nonExistentId = crypto.randomUUID()
        const response = await request('GET', '/:id', { param: { id: nonExistentId } })

        expect(response.status).toBe(HttpStatusCodes.NOT_FOUND)

        const responseJson = (await readResponse<User>(response)) as { message: string }

        expect(responseJson.message).toBeDefined()
      })

      it('should get user details', async () => {
        const response = await request('GET', '/:id', { param: { id: userId } })

        expect(response.status).toBe(HttpStatusCodes.OK)

        const responseJson = await readResponse<User>(response)

        expect(responseJson.data.id).toBe(userId)
        expect(responseJson.data.username).toBe(`${testUsername}_gettest`)
        expect(responseJson.data).not.toHaveProperty('password') // Password should not be returned / 不应返回密码
      })
    })

    describe('patch /system/user/{id} - update user', () => {
      let userId: string
      let builtInUserId: string

      beforeAll(async () => {
        const response = await request('POST', '', { json: { ...testUser, username: `${testUsername}_update`, roleIds: ['user'] } })

        expect(response.status).toBe(HttpStatusCodes.CREATED)

        const responseJson = await readResponse<User>(response)
        userId = responseJson.data.id

        builtInUserId = await getBuiltInUserId()
      })

      it('should validate empty body', async () => {
        const response = await request('PATCH', '/:id', { param: { id: userId }, json: {} })

        expect(response.status).toBe(HttpStatusCodes.UNPROCESSABLE_ENTITY)
      })

      it('should update user fields', async () => {
        const response = await request('PATCH', '/:id', { param: { id: userId }, json: { nickName: '更新后的昵称', avatar: 'https://example.com/new-avatar.png', homePath: '/system/role' } })

        expect(response.status).toBe(HttpStatusCodes.OK)

        const responseJson = await readResponse<User>(response)

        expect(responseJson.data.nickName).toBe('更新后的昵称')
        expect(responseJson.data.avatar).toBe('https://example.com/new-avatar.png')
        expect(responseJson.data.homePath).toBe('/system/role')
      })

      it('should update user roles together with user fields', async () => {
        const response = await request('PATCH', '/:id', { param: { id: userId }, json: { roleIds: ['user'] } })

        expect(response.status).toBe(HttpStatusCodes.OK)

        const responseJson = await readResponse<User>(response)
        expect(responseJson.data.roles).toEqual([expect.objectContaining({ id: 'user' })])
      })

      it('should refresh an online user session after role assignment changes', async () => {
        const session = await createAdminSession(userId)
        expect(session.roles).toContain('user')

        try {
          const response = await request('PATCH', '/:id', { param: { id: userId }, json: { roleIds: [] } })
          expect(response.status).toBe(HttpStatusCodes.OK)
          expect((await getAdminSession(userId, session.sessionId))?.roles).toEqual([])
        } finally {
          await revokeAdminSession(userId, session.sessionId)
          await request('PATCH', '/:id', { param: { id: userId }, json: { roleIds: ['user'] } })
        }
      })

      it('should revoke an online user session when the user is disabled', async () => {
        const session = await createAdminSession(userId)
        try {
          const response = await request('PATCH', '/:id', { param: { id: userId }, json: { status: Status.DISABLED } })
          expect(response.status).toBe(HttpStatusCodes.OK)
          expect(await getAdminSession(userId, session.sessionId)).toBeNull()
        } finally {
          await request('PATCH', '/:id', { param: { id: userId }, json: { status: Status.ENABLED } })
        }
      })

      it('should reject a home path without a leading slash', async () => {
        const response = await request('PATCH', '/:id', { param: { id: userId }, json: { homePath: 'system/role' } })

        expect(response.status).toBe(HttpStatusCodes.UNPROCESSABLE_ENTITY)
      })

      it('should return 403 when updating built-in user status', async () => {
        const response = await request('PATCH', '/:id', { param: { id: builtInUserId }, json: { status: Status.DISABLED } })

        expect(response.status).toBe(HttpStatusCodes.FORBIDDEN)

        const responseJson = (await readResponse<User>(response)) as { message: string }

        expect(responseJson.message).toBeDefined()
      })

      it('should return 404 for non-existent user', async () => {
        const nonExistentId = crypto.randomUUID()
        const response = await request('PATCH', '/:id', { param: { id: nonExistentId }, json: { nickName: 'Test' } })

        expect(response.status).toBe(HttpStatusCodes.NOT_FOUND)
      })
    })

    describe('delete /system/user/{id} - delete user', () => {
      let builtInUserId: string

      beforeAll(async () => {
        builtInUserId = await getBuiltInUserId()
      })

      it('should validate UUID format', async () => {
        const response = await request('DELETE', '/:id', { param: { id: 'invalid-uuid' } })

        expect(response.status).toBe(HttpStatusCodes.UNPROCESSABLE_ENTITY)
      })

      it('should return 403 when deleting built-in user', async () => {
        const response = await request('DELETE', '/:id', { param: { id: builtInUserId } })

        expect(response.status).toBe(HttpStatusCodes.FORBIDDEN)

        const responseJson = (await readResponse<User>(response)) as { message: string }

        expect(responseJson.message).toBeDefined()
      })

      it('should return 404 for non-existent user', async () => {
        const nonExistentId = crypto.randomUUID()
        const response = await request('DELETE', '/:id', { param: { id: nonExistentId } })

        expect(response.status).toBe(HttpStatusCodes.NOT_FOUND)
      })

      it('should delete user successfully', async () => {
        const createResponse = await request('POST', '', { json: { ...testUser, username: `${testUsername}_delete` } })

        expect(createResponse.status).toBe(HttpStatusCodes.CREATED)

        const json = await readResponse<User>(createResponse)
        const deleteTestUserId = json.data.id

        const deleteResponse = await request('DELETE', '/:id', { param: { id: deleteTestUserId } })

        expect(deleteResponse.status).toBe(HttpStatusCodes.OK)

        const deleteJson = await readResponse<User>(deleteResponse)

        expect(deleteJson.data.id).toBe(deleteTestUserId)

        const verifyResponse = await request('GET', '/:id', { param: { id: deleteTestUserId } })

        expect(verifyResponse.status).toBe(HttpStatusCodes.NOT_FOUND)
      })
    })
  })
}
