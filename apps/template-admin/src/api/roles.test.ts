import { beforeEach, expect, test, vi } from 'vite-plus/test'

const mocks = vi.hoisted(() => ({
  get: vi.fn<(url: string, config?: unknown) => Promise<unknown>>(),
  request: vi.fn<(url: string, config: unknown) => Promise<unknown>>(),
}))

vi.mock('./request', () => ({
  requestClient: {
    get: mocks.get,
    request: mocks.request,
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

test('loads roles through the existing system roles endpoint', async () => {
  mocks.get.mockResolvedValue([{ id: 'admin', name: '管理员', status: 'ENABLED' }])
  const { getSystemRolesApi } = await import('./roles')

  await expect(getSystemRolesApi()).resolves.toHaveLength(1)
  expect(mocks.get).toHaveBeenCalledWith('/admin/system/roles', {
    params: { current: 1, pageSize: 100 },
  })
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
