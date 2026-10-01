import { newEnforcer, newModel } from 'casbin'
import { describe, expect, it, vi } from 'vite-plus/test'

import { getAdminPermissionCatalog } from './permission-catalog'
import { getRoleApiPermissions } from './permissions'

vi.mock('./permission-catalog', () => ({ getAdminPermissionCatalog: vi.fn<typeof getAdminPermissionCatalog>() }))

describe('getRoleApiPermissions', () => {
  it('reports newly added admin endpoints without requiring database policies', async () => {
    const enforcer = await newEnforcer(newModel())
    vi.mocked(getAdminPermissionCatalog).mockReturnValue([{ resource: '/new-feature/{id}', action: 'PATCH', summary: '新增接口', group: '测试' }])

    expect(await getRoleApiPermissions(enforcer, 'admin')).toEqual([['admin', '/new-feature/{id}', 'PATCH']])
  })

  it('keeps non-admin permissions supplied by Casbin, including inherited permissions', async () => {
    const enforcer = await newEnforcer(newModel())
    const getPermissions = vi.spyOn(enforcer, 'getImplicitPermissionsForUser').mockResolvedValue([['reader', '/reports', 'GET']])

    expect(await getRoleApiPermissions(enforcer, 'operator')).toEqual([['reader', '/reports', 'GET']])
    expect(getPermissions).toHaveBeenCalledWith('operator')
  })
})
