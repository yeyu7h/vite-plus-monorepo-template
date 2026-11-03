import { HttpStatusCodes } from '@monorepo/server-core'
import { afterAll, beforeAll, describe, expect, it } from 'vite-plus/test'
import { createAdminClient, readResponse, type AdminRouteTestContext } from './admin-client'

type RoleFixture = { id: string; name: string; status: 'ENABLED' }
type Role = { id: string; name: string; description: string | null; status: string; parentRoles: string[]; createdAt: string | null }
type RolePermissions = { permissions: { resource: string; action: string; direct: boolean; inherited: boolean }[]; groupings: string[][] }
type PermissionChanges = { added: number; removed: number; total: number }

type RoleRouteTestContext = AdminRouteTestContext & {
  createRole: (role: RoleFixture) => Promise<void>
  deleteRole: (id: string) => Promise<void>
}

export function defineRoleRouteTests({ app, getAdminToken, getUserToken, enforcerPromise, cleanup, createRole, deleteRole }: RoleRouteTestContext) {
  const Status = { ENABLED: 'ENABLED', DISABLED: 'DISABLED' } as const
  const suffix = Array.from(crypto.getRandomValues(new Uint8Array(8)), (value) => String.fromCharCode(97 + (value % 26))).join('')
  const testRoleId = `test_role_${suffix}`
  const testRole = { id: testRoleId, name: '测试角色', description: '这是一个测试角色', status: Status.ENABLED }
  const filterRoleId = `${testRoleId}_filter`
  const filterRoleName = `筛选_${testRoleId}`
  let adminToken: string
  let userToken: string
  const request = createAdminClient(app, '/system/roles', () => adminToken)

  describe('system role routes', () => {
    beforeAll(async () => {
      await cleanup(testRoleId)

      adminToken = await getAdminToken()
      userToken = await getUserToken()
      await createRole({ id: filterRoleId, name: filterRoleName, status: Status.ENABLED })
      await createRole({ id: `${testRoleId}_other`, name: '不匹配的角色', status: Status.ENABLED })
    })

    afterAll(async () => {
      await cleanup(testRoleId)
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

      it('should reject inheritance changes from a non-admin with the update API permission', async () => {
        const roleId = `${testRoleId}_delegated`
        await createRole({ id: roleId, name: '委派测试角色', status: Status.ENABLED })
        const enforcer = await enforcerPromise
        const added = await enforcer.addPolicy('user', '/system/roles/{id}', 'PATCH')
        try {
          const response = await request('PATCH', '/:id', { param: { id: roleId }, json: { parentRoleIds: ['admin'] } }, userToken)
          expect(response.status).toBe(HttpStatusCodes.FORBIDDEN)
        } finally {
          if (added) await enforcer.removePolicy('user', '/system/roles/{id}', 'PATCH')
          await deleteRole(roleId)
        }
      })
    })

    describe('get /system/role - list roles', () => {
      it('should validate pagination parameters', async () => {
        const response = await request('GET', '', { query: { current: 'invalid', pageSize: -1 } })

        expect(response.status).toBe(HttpStatusCodes.UNPROCESSABLE_ENTITY)
      })

      it('should list roles with default pagination', async () => {
        const response = await request('GET', '', { query: {} })

        expect(response.status).toBe(HttpStatusCodes.OK)

        const responseJson = await readResponse<Role[]>(response)

        expect(responseJson.data).toBeDefined()
        expect(Array.isArray(responseJson.data)).toBe(true)
      })

      it.each([
        ['id', filterRoleId],
        ['name', filterRoleName],
      ])('should support filtering by %s', async (field, value) => {
        const response = await request('GET', '', { query: { filters: JSON.stringify([{ field, operator: 'contains', value }]) } })
        expect(response.status).toBe(HttpStatusCodes.OK)
        const { data } = await readResponse<Role[]>(response)
        expect(data).toEqual([expect.objectContaining({ id: filterRoleId, name: filterRoleName })])
      })

      it('should list roles with parent roles information', async () => {
        const parentRoleId = `${testRoleId}_list_parent`
        const childRoleId = `${testRoleId}_list_child`

        await request('POST', '', { json: { ...testRole, id: parentRoleId, name: '列表测试父角色' } })

        await request('POST', '', { json: { ...testRole, id: childRoleId, name: '列表测试子角色', parentRoleIds: [parentRoleId] } })

        const response = await request('GET', '', { query: { filters: JSON.stringify([{ field: 'id', operator: 'eq', value: childRoleId }]) } })

        expect(response.status).toBe(HttpStatusCodes.OK)

        const responseJson = await readResponse<Role[]>(response)
        const items: Role[] = Array.isArray(responseJson.data) ? responseJson.data : []

        expect(items.length).toBeGreaterThan(0)

        const childRole = items.find((r) => r.id === childRoleId)

        expect(childRole).toBeDefined()

        expect(childRole?.parentRoles).toBeInstanceOf(Array)
        expect(childRole?.parentRoles).toContain(parentRoleId)
      })

      it.each(['asc', 'desc'] as const)('should sort roles by creation time %s', async (order) => {
        const query = {
          filters: JSON.stringify([{ field: 'id', operator: 'startswith', value: testRoleId }]),
          ...(order === 'desc' ? { sorters: JSON.stringify([{ field: 'createdAt', order }]) } : {}),
        }
        const response = await request('GET', '', { query })
        expect(response.status).toBe(HttpStatusCodes.OK)
        const { data } = await readResponse<Role[]>(response)
        const roles = data
        expect(roles.length).toBeGreaterThanOrEqual(2)
        const timestamps = roles.map(({ createdAt }) => {
          expect(createdAt).toBeTypeOf('string')
          return new Date(createdAt!).getTime()
        })
        expect(timestamps).toEqual([...timestamps].sort((left, right) => (order === 'asc' ? left - right : right - left)))
      })
    })

    describe('post /system/role - create role', () => {
      it('should validate required fields', async () => {
        const response = await request('POST', '', { json: { id: `${testRoleId}_required` } })

        expect(response.status).toBe(HttpStatusCodes.UNPROCESSABLE_ENTITY)

        const responseJson = (await readResponse<Role>(response)) as { message?: string; error?: { issues?: unknown } }

        expect(responseJson.error?.issues).toBeDefined()
      })

      it.each(['', 'TestRole', 'test-role!', 'a'.repeat(65)])('should reject invalid role id %j', async (id) => {
        const response = await request('POST', '', { json: { ...testRole, id } })
        expect(response.status).toBe(HttpStatusCodes.UNPROCESSABLE_ENTITY)
      })

      it.each(['', '测'.repeat(65)])('should reject invalid role name %j', async (name) => {
        const response = await request('POST', '', { json: { ...testRole, id: `${testRoleId}_name`, name } })
        expect(response.status).toBe(HttpStatusCodes.UNPROCESSABLE_ENTITY)
      })

      it('should create a new role', async () => {
        const newRoleId = `${testRoleId}_create`
        const response = await request('POST', '', { json: { ...testRole, id: newRoleId } })

        expect(response.status).toBe(HttpStatusCodes.CREATED)

        const responseJson = await readResponse<Role>(response)

        expect(responseJson.data.id).toBe(newRoleId)
        expect(responseJson.data.name).toBe(testRole.name)
        expect(responseJson.data.description).toBe(testRole.description)
        expect(responseJson.data.status).toBe(testRole.status)
      })

      it('should create a new role with parent roles', async () => {
        const parentRole1Id = `${testRoleId}_parent_one`
        const parentRole2Id = `${testRoleId}_parent_two`

        await request('POST', '', { json: { ...testRole, id: parentRole1Id, name: '父角色1' } })

        await request('POST', '', { json: { ...testRole, id: parentRole2Id, name: '父角色2' } })

        const childRoleId = `${testRoleId}_child`
        const response = await request('POST', '', { json: { ...testRole, id: childRoleId, name: '子角色', parentRoleIds: [parentRole1Id, parentRole2Id] } })

        expect(response.status).toBe(HttpStatusCodes.CREATED)

        const responseJson = await readResponse<Role>(response)

        expect(responseJson.data.id).toBe(childRoleId)
        expect(responseJson.data.name).toBe('子角色')
        expect(responseJson.data.parentRoles).toBeInstanceOf(Array)

        expect(responseJson.data.parentRoles).toContain(parentRole1Id)
        expect(responseJson.data.parentRoles).toContain(parentRole2Id)
        expect(responseJson.data.parentRoles.length).toBe(2)
      })

      it('should return 400 for non-existent parent role', async () => {
        const newRoleId = `${testRoleId}_invalid_parent`
        const response = await request('POST', '', { json: { ...testRole, id: newRoleId, parentRoleIds: ['non_existent_parent_role'] } })

        expect(response.status).toBe(HttpStatusCodes.BAD_REQUEST)

        const responseJson = (await readResponse<Role>(response)) as { message: string }

        expect(responseJson.message).toContain('上级角色不存在')
      })

      it('should not allow inheriting the built-in admin role', async () => {
        const response = await request('POST', '', { json: { ...testRole, id: `${testRoleId}_admin_parent`, parentRoleIds: ['admin'] } })

        expect(response.status).toBe(HttpStatusCodes.BAD_REQUEST)
      })

      it('should return 409 for duplicate role id', async () => {
        const duplicateRoleId = `${testRoleId}_duplicate`

        const response1 = await request('POST', '', { json: { ...testRole, id: duplicateRoleId } })

        expect(response1.status).toBe(HttpStatusCodes.CREATED)

        const response2 = await request('POST', '', { json: { ...testRole, id: duplicateRoleId } })

        expect(response2.status).toBe(HttpStatusCodes.CONFLICT)

        const json = (await readResponse<Role>(response2)) as { message: string }

        expect(json.message).toContain('已存在')
      })
    })

    describe('get /system/role/{id} - get role', () => {
      let roleId: string

      beforeAll(async () => {
        roleId = `${testRoleId}_gettest`
        const response = await request('POST', '', { json: { ...testRole, id: roleId } })

        expect(response.status).toBe(HttpStatusCodes.CREATED)
      })

      it('should validate id format', async () => {
        const response = await request('GET', '/:id', { param: { id: 'Invalid-ID' } })

        expect(response.status).toBe(HttpStatusCodes.UNPROCESSABLE_ENTITY)
      })

      it('should return 404 for non-existent role', async () => {
        const nonExistentId = 'non_existent_role_id'
        const response = await request('GET', '/:id', { param: { id: nonExistentId } })

        expect(response.status).toBe(HttpStatusCodes.NOT_FOUND)

        const responseJson = (await readResponse<Role>(response)) as { message: string }

        expect(responseJson.message).toBeDefined()
      })

      it('should get role details', async () => {
        const response = await request('GET', '/:id', { param: { id: roleId } })

        expect(response.status).toBe(HttpStatusCodes.OK)

        const responseJson = await readResponse<Role>(response)

        expect(responseJson.data.id).toBe(roleId)
        expect(responseJson.data.name).toBe(testRole.name)
      })

      it('should get role details with parent roles', async () => {
        const parentRoleId = `${testRoleId}_gettest_parent`
        const childRoleId = `${testRoleId}_gettest_child`

        await request('POST', '', { json: { ...testRole, id: parentRoleId, name: '获取测试父角色' } })

        await request('POST', '', { json: { ...testRole, id: childRoleId, name: '获取测试子角色', parentRoleIds: [parentRoleId] } })

        const response = await request('GET', '/:id', { param: { id: childRoleId } })

        expect(response.status).toBe(HttpStatusCodes.OK)

        const responseJson = await readResponse<Role>(response)

        expect(responseJson.data.id).toBe(childRoleId)
        expect(responseJson.data.name).toBe('获取测试子角色')
        expect(responseJson.data.parentRoles).toBeInstanceOf(Array)
        expect(responseJson.data.parentRoles).toContain(parentRoleId)
      })
    })

    describe('patch /system/role/{id} - update role', () => {
      let roleId: string

      beforeAll(async () => {
        roleId = `${testRoleId}_update`
        const response = await request('POST', '', { json: { ...testRole, id: roleId } })

        expect(response.status).toBe(HttpStatusCodes.CREATED)
      })

      it('should allow empty body (all fields optional in patch)', async () => {
        const response = await request('PATCH', '/:id', { param: { id: roleId }, json: {} })

        expect(response.status).toBe(HttpStatusCodes.OK)
      })

      it('should update role fields', async () => {
        const response = await request('PATCH', '/:id', { param: { id: roleId }, json: { name: '更新后的角色名称', description: '更新后的角色描述', status: Status.DISABLED } })

        expect(response.status).toBe(HttpStatusCodes.OK)

        const responseJson = await readResponse<Role>(response)

        expect(responseJson.data.name).toBe('更新后的角色名称')
        expect(responseJson.data.description).toBe('更新后的角色描述')
        expect(responseJson.data.status).toBe(Status.DISABLED)
      })

      it('should only update allowed fields', async () => {
        const response = await request('PATCH', '/:id', { param: { id: roleId }, json: { name: '测试名称', description: '测试描述' } })

        expect(response.status).toBe(HttpStatusCodes.OK)

        const responseJson = await readResponse<Role>(response)

        expect(responseJson.data.id).toBe(roleId) // ID should remain unchanged / ID 应该保持不变
        expect(responseJson.data.name).toBe('测试名称')
        expect(responseJson.data.description).toBe('测试描述')
      })

      it('should return 404 for non-existent role', async () => {
        const nonExistentId = 'non_existent_role'
        const response = await request('PATCH', '/:id', { param: { id: nonExistentId }, json: { name: 'Test' } })

        expect(response.status).toBe(HttpStatusCodes.NOT_FOUND)
      })

      it('should update role with parent roles', async () => {
        const parentRole1Id = `${testRoleId}_update_parent_one`
        const parentRole2Id = `${testRoleId}_update_parent_two`
        const updateRoleId = `${testRoleId}_update_hierarchy`

        await request('POST', '', { json: { ...testRole, id: parentRole1Id, name: '更新测试父角色1' } })

        await request('POST', '', { json: { ...testRole, id: parentRole2Id, name: '更新测试父角色2' } })

        await request('POST', '', { json: { ...testRole, id: updateRoleId, name: '更新测试角色', parentRoleIds: [parentRole1Id] } })

        const response = await request('PATCH', '/:id', { param: { id: updateRoleId }, json: { parentRoleIds: [parentRole1Id, parentRole2Id] } })

        expect(response.status).toBe(HttpStatusCodes.OK)

        const responseJson = await readResponse<Role>(response)

        expect(responseJson.data.id).toBe(updateRoleId)
        expect(responseJson.data.parentRoles).toBeInstanceOf(Array)

        expect(responseJson.data.parentRoles).toContain(parentRole1Id)
        expect(responseJson.data.parentRoles).toContain(parentRole2Id)
        expect(responseJson.data.parentRoles.length).toBe(2)
      })

      it('should prevent circular inheritance when updating parent roles', async () => {
        const roleAId = `${testRoleId}_circular_a`
        const roleBId = `${testRoleId}_circular_b`

        await request('POST', '', { json: { ...testRole, id: roleAId, name: '循环测试角色A' } })

        await request('POST', '', { json: { ...testRole, id: roleBId, name: '循环测试角色B', parentRoleIds: [roleAId] } })

        const response = await request('PATCH', '/:id', { param: { id: roleAId }, json: { parentRoleIds: [roleBId] } })

        expect(response.status).toBe(HttpStatusCodes.BAD_REQUEST)

        const responseJson = (await readResponse<Role>(response)) as { message: string }

        expect(responseJson.message).toContain('循环继承')
      })

      it('should clear parent roles when empty array provided', async () => {
        const clearRoleId = `${testRoleId}_clear_parents`
        const parentRoleId = `${testRoleId}_clear_parent`

        await request('POST', '', { json: { ...testRole, id: parentRoleId, name: '清除测试父角色' } })

        await request('POST', '', { json: { ...testRole, id: clearRoleId, name: '清除测试角色', parentRoleIds: [parentRoleId] } })

        const response = await request('PATCH', '/:id', { param: { id: clearRoleId }, json: { parentRoleIds: [] } })

        expect(response.status).toBe(HttpStatusCodes.OK)

        const responseJson = await readResponse<Role>(response)

        expect(responseJson.data.id).toBe(clearRoleId)
        expect(responseJson.data.parentRoles).toBeInstanceOf(Array)

        expect(responseJson.data.parentRoles.length).toBe(0)
      })
    })

    describe('delete /system/role/{id} - delete role', () => {
      it('should validate id format', async () => {
        const response = await request('DELETE', '/:id', { param: { id: 'Invalid-ID' } })

        expect(response.status).toBe(HttpStatusCodes.UNPROCESSABLE_ENTITY)
      })

      it('should return 404 for non-existent role', async () => {
        const nonExistentId = 'non_existent_role'
        const response = await request('DELETE', '/:id', { param: { id: nonExistentId } })

        expect(response.status).toBe(HttpStatusCodes.NOT_FOUND)
      })

      it('should delete role successfully', async () => {
        const deleteTestRoleId = `${testRoleId}_delete`
        const createResponse = await request('POST', '', { json: { ...testRole, id: deleteTestRoleId } })

        expect(createResponse.status).toBe(HttpStatusCodes.CREATED)

        const deleteResponse = await request('DELETE', '/:id', { param: { id: deleteTestRoleId } })

        expect(deleteResponse.status).toBe(HttpStatusCodes.OK)

        const deleteResponseJson = await readResponse<Role>(deleteResponse)

        expect(deleteResponseJson.data.id).toBe(deleteTestRoleId)

        const verifyResponse = await request('GET', '/:id', { param: { id: deleteTestRoleId } })

        expect(verifyResponse.status).toBe(HttpStatusCodes.NOT_FOUND)
      })
    })

    describe('get /system/role/{id}/permissions - get role permissions', () => {
      let roleId: string

      beforeAll(async () => {
        roleId = `${testRoleId}_permissions`
        const response = await request('POST', '', { json: { ...testRole, id: roleId } })

        expect(response.status).toBe(HttpStatusCodes.CREATED)
      })

      it('should validate id format', async () => {
        const response = await request('GET', '/:id/permissions', { param: { id: 'Invalid-ID' } })

        expect(response.status).toBe(HttpStatusCodes.UNPROCESSABLE_ENTITY)
      })

      it('should get role permissions', async () => {
        const response = await request('GET', '/:id/permissions', { param: { id: roleId } })

        expect(response.status).toBe(HttpStatusCodes.OK)

        const responseJson = await readResponse<RolePermissions>(response)

        expect(responseJson.data).toBeDefined()
        expect(responseJson.data).toHaveProperty('permissions')
        expect(responseJson.data).toHaveProperty('groupings')
        expect(Array.isArray(responseJson.data.permissions)).toBe(true)
        expect(Array.isArray(responseJson.data.groupings)).toBe(true)
        expect(responseJson.data.permissions.length).toBe(0)
      })

      it('should get admin role permissions', async () => {
        const response = await request('GET', '/:id/permissions', { param: { id: 'admin' } })
        expect(response.status).toBe(HttpStatusCodes.OK)
        const { data } = await readResponse<RolePermissions>(response)
        expect(data.groupings).toBeInstanceOf(Array)
        expect(data.permissions).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ resource: '/resources/object-storage/upload', action: 'POST', direct: true }),
            expect.objectContaining({ resource: '/resources/object-storage/download', action: 'POST', direct: true }),
          ]),
        )
      })
    })

    describe('put /system/role/{id}/permissions - save role permissions', () => {
      let roleId: string

      beforeAll(async () => {
        roleId = `${testRoleId}_save_permissions`
        const response = await request('POST', '', { json: { ...testRole, id: roleId } })
        expect(response.status).toBe(HttpStatusCodes.CREATED)
      })

      it('should validate id format', async () => {
        const response = await request('PUT', '/:id/permissions', { param: { id: 'Invalid-ID' }, json: { permissions: [['resource', 'action']] } })

        expect(response.status).toBe(HttpStatusCodes.UNPROCESSABLE_ENTITY)
      })

      it.each([{ permissions: 'not-an-array' }, { permissions: [['resource']] }, { permissions: [['', 'action']] }])('should reject invalid permissions $permissions', async (json) => {
        const response = await request('PUT', '/:id/permissions', { param: { id: roleId }, json })
        expect(response.status).toBe(HttpStatusCodes.UNPROCESSABLE_ENTITY)
      })

      it('should save role permissions successfully', async () => {
        const response = await request('PUT', '/:id/permissions', {
          param: { id: roleId },
          json: {
            permissions: [
              ['/system/users', 'GET'],
              ['/system/users', 'POST'],
              ['/system/roles', 'GET'],
            ],
          },
        })

        expect(response.status).toBe(HttpStatusCodes.OK)

        const responseJson = await readResponse<PermissionChanges>(response)

        expect(responseJson.data).toHaveProperty('added')
        expect(responseJson.data).toHaveProperty('removed')
        expect(responseJson.data).toHaveProperty('total')
        expect(typeof responseJson.data.added).toBe('number')
        expect(typeof responseJson.data.removed).toBe('number')
        expect(typeof responseJson.data.total).toBe('number')
        expect(responseJson.data.total).toBe(3)
      })

      it('should update permissions (replace existing)', async () => {
        await request('PUT', '/:id/permissions', {
          param: { id: roleId },
          json: {
            permissions: [
              ['/system/users', 'GET'],
              ['/system/users', 'POST'],
              ['/system/roles', 'GET'],
            ],
          },
        })

        const response = await request('PUT', '/:id/permissions', {
          param: { id: roleId },
          json: {
            permissions: [
              ['/system/roles', 'POST'],
              ['/system/roles', 'DELETE'],
            ],
          },
        })

        expect(response.status).toBe(HttpStatusCodes.OK)

        const responseJson = await readResponse<PermissionChanges>(response)

        expect(responseJson.data.total).toBe(2)
        expect(responseJson.data.removed).toBeGreaterThan(0) // Should have removed previous permissions

        const verifyResponse = await request('GET', '/:id/permissions', { param: { id: roleId } })

        expect(verifyResponse.status).toBe(HttpStatusCodes.OK)

        const verifyJson = await readResponse<RolePermissions>(verifyResponse)

        expect(verifyJson.data.permissions.length).toBe(2)
        expect(verifyJson.data.permissions).toContainEqual(expect.objectContaining({ resource: '/system/roles', action: 'POST', direct: true, inherited: false }))
        expect(verifyJson.data.permissions).toContainEqual(expect.objectContaining({ resource: '/system/roles', action: 'DELETE', direct: true, inherited: false }))
      })

      it('should clear all permissions when empty array provided', async () => {
        await request('PUT', '/:id/permissions', {
          param: { id: roleId },
          json: {
            permissions: [
              ['/system/users', 'GET'],
              ['/system/roles', 'GET'],
            ],
          },
        })

        const response = await request('PUT', '/:id/permissions', { param: { id: roleId }, json: { permissions: [] } })

        expect(response.status).toBe(HttpStatusCodes.OK)

        const responseJson = await readResponse<PermissionChanges>(response)

        expect(responseJson.data.total).toBe(0)
        expect(responseJson.data.removed).toBeGreaterThan(0)

        const verifyResponse = await request('GET', '/:id/permissions', { param: { id: roleId } })

        expect(verifyResponse.status).toBe(HttpStatusCodes.OK)

        const verifyJson = await readResponse<RolePermissions>(verifyResponse)

        expect(verifyJson.data.permissions.length).toBe(0)
      })

      it('should return 404 for non-existent role', async () => {
        const nonExistentId = 'non_existent_role'
        const response = await request('PUT', '/:id/permissions', { param: { id: nonExistentId }, json: { permissions: [['/api/admin', 'read']] } })

        expect(response.status).toBe(HttpStatusCodes.NOT_FOUND)
      })

      it('should allow updating permissions without inherited permissions', async () => {
        const parentRoleId = `${testRoleId}_perm_parent`
        const childRoleId = `${testRoleId}_perm_child`

        await request('POST', '', { json: { ...testRole, id: parentRoleId, name: '权限测试父角色' } })

        const addParentPermsResponse = await request('PUT', '/:id/permissions', {
          param: { id: parentRoleId },
          json: {
            permissions: [
              ['/system/users', 'GET'],
              ['/system/users', 'POST'],
            ],
          },
        })

        expect(addParentPermsResponse.status).toBe(HttpStatusCodes.OK)

        await request('POST', '', { json: { ...testRole, id: childRoleId, name: '权限测试子角色', parentRoleIds: [parentRoleId] } })

        const addChildPermsResponse = await request('PUT', '/:id/permissions', { param: { id: childRoleId }, json: { permissions: [['/system/roles', 'GET']] } })

        expect(addChildPermsResponse.status).toBe(HttpStatusCodes.OK)

        const getPermsResponse = await request('GET', '/:id/permissions', { param: { id: childRoleId } })

        expect(getPermsResponse.status).toBe(HttpStatusCodes.OK)

        const getPermsResponseJson = await readResponse<RolePermissions>(getPermsResponse)

        expect(getPermsResponseJson.data.permissions.length).toBe(3)

        expect(getPermsResponseJson.data.permissions).toContainEqual(expect.objectContaining({ resource: '/system/roles', action: 'GET', direct: true, inherited: false }))
        expect(getPermsResponseJson.data.permissions).toContainEqual(expect.objectContaining({ resource: '/system/users', action: 'GET', direct: false, inherited: true }))
        expect(getPermsResponseJson.data.permissions).toContainEqual(expect.objectContaining({ resource: '/system/users', action: 'POST', direct: false, inherited: true }))

        const updateResponse = await request('PUT', '/:id/permissions', {
          param: { id: childRoleId },
          json: {
            permissions: [
              ['/system/roles', 'GET'],
              ['/system/roles', 'POST'],
            ],
          },
        })

        expect(updateResponse.status).toBe(HttpStatusCodes.OK)

        const updateResponseJson = await readResponse<PermissionChanges>(updateResponse)

        expect(updateResponseJson.data.total).toBe(2)

        const verifyResponse = await request('GET', '/:id/permissions', { param: { id: childRoleId } })

        expect(verifyResponse.status).toBe(HttpStatusCodes.OK)

        const verifyJson = await readResponse<RolePermissions>(verifyResponse)

        expect(verifyJson.data.permissions.length).toBe(4)

        expect(verifyJson.data.permissions).toContainEqual(expect.objectContaining({ resource: '/system/roles', action: 'GET', direct: true, inherited: false }))
        expect(verifyJson.data.permissions).toContainEqual(expect.objectContaining({ resource: '/system/roles', action: 'POST', direct: true, inherited: false }))
        expect(verifyJson.data.permissions).toContainEqual(expect.objectContaining({ resource: '/system/users', action: 'GET', direct: false, inherited: true }))
        expect(verifyJson.data.permissions).toContainEqual(expect.objectContaining({ resource: '/system/users', action: 'POST', direct: false, inherited: true }))
      })

      it('should prevent adding duplicate inherited permissions', async () => {
        const parentRoleId = `${testRoleId}_dup_parent`
        const childRoleId = `${testRoleId}_dup_child`

        await request('POST', '', { json: { ...testRole, id: parentRoleId, name: '重复权限测试父角色' } })

        await request('PUT', '/:id/permissions', {
          param: { id: parentRoleId },
          json: {
            permissions: [
              ['/system/users', 'GET'],
              ['/system/users', 'POST'],
            ],
          },
        })

        await request('POST', '', { json: { ...testRole, id: childRoleId, name: '重复权限测试子角色', parentRoleIds: [parentRoleId] } })

        const response = await request('PUT', '/:id/permissions', {
          param: { id: childRoleId },
          json: {
            permissions: [
              ['/system/roles', 'GET'],
              ['/system/users', 'GET'],
            ],
          },
        })

        expect(response.status).toBe(HttpStatusCodes.BAD_REQUEST)

        const responseJson = (await readResponse<PermissionChanges>(response)) as { message: string }

        expect(responseJson.message).toContain('不能重复添加已继承的权限')
        expect(responseJson.message).toContain('/system/users:GET')
      })
    })
  })
}
