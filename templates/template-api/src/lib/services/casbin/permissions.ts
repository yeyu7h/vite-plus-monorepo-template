import type { Enforcer } from 'casbin'

import { getAdminPermissionCatalog } from './permission-catalog'

/** admin 的权限随管理端接口目录自动更新；其他角色保留 Casbin 授权与继承规则。 */
export async function getRoleApiPermissions(enforcer: Enforcer, roleId: string): Promise<string[][]> {
  if (roleId === 'admin') {
    return getAdminPermissionCatalog().map(({ resource, action }) => [roleId, resource, action])
  }

  return enforcer.getImplicitPermissionsForUser(roleId)
}
