import { beforeEach, expect, test, vi } from 'vite-plus/test'

const mocks = vi.hoisted(() => ({
  delete: vi.fn<(url: string) => Promise<unknown>>(),
  get: vi.fn<(url: string, config?: unknown) => Promise<unknown>>(),
  post: vi.fn<(url: string, data: unknown) => Promise<unknown>>(),
  request: vi.fn<(url: string, config: unknown) => Promise<unknown>>(),
}))

vi.mock('./request', () => ({
  requestClient: {
    delete: mocks.delete,
    get: mocks.get,
    post: mocks.post,
    request: mocks.request,
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

test('loads roles through the existing system roles endpoint', async () => {
  mocks.get.mockResolvedValue({
    data: {
      data: [{ id: 'admin', name: '管理员', status: 'ENABLED' }],
    },
    headers: { 'x-total-count': '37' },
  })
  const { getSystemRolesApi } = await import('./roles')

  await expect(getSystemRolesApi({ current: 2, pageSize: 20, search: '管理', status: 'ENABLED' })).resolves.toEqual({
    items: [{ id: 'admin', name: '管理员', status: 'ENABLED' }],
    total: 37,
  })
  expect(mocks.get).toHaveBeenCalledWith('/admin/system/roles', {
    params: {
      current: 2,
      filters: JSON.stringify([
        {
          operator: 'or',
          value: [
            { field: 'id', operator: 'contains', value: '管理' },
            { field: 'name', operator: 'contains', value: '管理' },
          ],
        },
        { field: 'status', operator: 'eq', value: 'ENABLED' },
      ]),
      pageSize: 20,
      sorters: JSON.stringify([{ field: 'createdAt', order: 'desc' }]),
    },
    responseReturn: 'raw',
  })
})

test('loads all role options and falls back to the item count when the total header is missing', async () => {
  const roles = [{ id: 'admin', name: '管理员', status: 'ENABLED' }]
  mocks.get.mockResolvedValueOnce({ data: { data: roles }, headers: {} }).mockResolvedValueOnce(roles)
  const { getSystemRoleOptionsApi, getSystemRolesApi } = await import('./roles')

  await expect(getSystemRolesApi({ current: 1, pageSize: 20 })).resolves.toEqual({ items: roles, total: 1 })
  await expect(getSystemRoleOptionsApi()).resolves.toEqual(roles)
  expect(mocks.get).toHaveBeenLastCalledWith('/admin/system/roles', {
    params: {
      mode: 'off',
      sorters: JSON.stringify([{ field: 'name', order: 'asc' }]),
    },
  })
})

test('creates, updates, and deletes roles', async () => {
  const role = {
    id: 'editor',
    name: '编辑',
    description: null,
    menuIds: ['00000000-0000-0000-0000-000000000000'],
    status: 'ENABLED' as const,
    parentRoleIds: ['user'],
  }
  mocks.delete.mockResolvedValue({ id: role.id })
  mocks.post.mockResolvedValue(role)
  mocks.request.mockResolvedValue(role)
  const { createSystemRoleApi, deleteSystemRoleApi, updateSystemRoleApi } = await import('./roles')

  await expect(createSystemRoleApi(role)).resolves.toEqual(role)
  expect(mocks.post).toHaveBeenCalledWith('/admin/system/roles', role)

  const { id, ...update } = role
  await expect(updateSystemRoleApi(id, update)).resolves.toEqual(role)
  expect(mocks.request).toHaveBeenCalledWith('/admin/system/roles/editor', {
    data: update,
    method: 'PATCH',
  })

  await expect(deleteSystemRoleApi(id)).resolves.toEqual({ id })
  expect(mocks.delete).toHaveBeenCalledWith('/admin/system/roles/editor')
})

test('loads and saves role menu permissions', async () => {
  const payload = { menus: [] }
  mocks.get.mockResolvedValue(payload)
  mocks.request.mockResolvedValue(payload)
  const { getRoleMenuPermissionsApi, saveRoleMenuPermissionsApi } = await import('./roles')

  await expect(getRoleMenuPermissionsApi('admin')).resolves.toEqual(payload)
  expect(mocks.get).toHaveBeenCalledWith('/admin/system/roles/admin/menu-permissions')

  await expect(saveRoleMenuPermissionsApi('admin', ['00000000-0000-0000-0000-000000000000'])).resolves.toEqual(payload)
  expect(mocks.request).toHaveBeenCalledWith('/admin/system/roles/admin/menu-permissions', {
    data: { menuIds: ['00000000-0000-0000-0000-000000000000'] },
    method: 'PUT',
  })
})
