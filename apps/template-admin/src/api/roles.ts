import { requestClient } from './request'

export interface SystemRoleOption {
  id: string
  name: string
  parentRoles?: string[]
  status: string
}

export interface RoleMenuPermission {
  action: null | string
  children: RoleMenuPermission[]
  code: null | string
  disabled: boolean
  direct: boolean
  granted: boolean
  inherited: boolean
  id: string
  path: null | string
  resource: null | string
  title: string
  type: 'DIRECTORY' | 'PAGE' | 'EXTERNAL' | 'IFRAME' | 'BUTTON'
}

export interface RoleMenuPermissionsResponse {
  menus: RoleMenuPermission[]
}

export function getSystemRolesApi() {
  return requestClient.get<SystemRoleOption[]>('/admin/system/roles', {
    params: { current: 1, pageSize: 100 },
  })
}

export function getRoleMenuPermissionsApi(roleId: string) {
  return requestClient.get<RoleMenuPermissionsResponse>(`/admin/system/roles/${roleId}/menu-permissions`)
}

export function saveRoleMenuPermissionsApi(roleId: string, menuIds: string[]) {
  return requestClient.request<RoleMenuPermissionsResponse>(`/admin/system/roles/${roleId}/menu-permissions`, {
    data: { menuIds },
    method: 'PUT',
  })
}
