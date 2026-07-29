import type { RequestResponse } from '@monorepo/request'

import { requestClient } from './request'

export type SystemRoleStatus = 'DISABLED' | 'ENABLED'

export interface SystemRole {
  createdAt: null | string
  createdBy: null | string
  description: null | string
  id: string
  name: string
  parentRoles: string[]
  status: SystemRoleStatus
  updatedAt: null | string
  updatedBy: null | string
}

export type SystemRoleOption = SystemRole

export interface SystemRoleMutation {
  description: null | string
  menuIds?: string[]
  name: string
  parentRoleIds?: string[]
  status: SystemRoleStatus
}

export interface CreateSystemRoleMutation extends SystemRoleMutation {
  id: string
}

export interface SystemRolesListParams {
  current: number
  pageSize: number
  search?: string
  status?: SystemRoleStatus
}

export interface SystemRolesListResult {
  items: SystemRole[]
  total: number
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

export async function getSystemRolesApi(params: SystemRolesListParams): Promise<SystemRolesListResult> {
  const filters: unknown[] = []
  const search = params.search?.trim()

  if (search) {
    filters.push({
      operator: 'or',
      value: [
        { field: 'id', operator: 'contains', value: search },
        { field: 'name', operator: 'contains', value: search },
      ],
    })
  }
  if (params.status) filters.push({ field: 'status', operator: 'eq', value: params.status })

  const response = await requestClient.get<RequestResponse<{ data: SystemRole[] }>>('/admin/system/roles', {
    params: {
      current: params.current,
      filters: filters.length > 0 ? JSON.stringify(filters) : undefined,
      pageSize: params.pageSize,
      sorters: JSON.stringify([{ field: 'createdAt', order: 'desc' }]),
    },
    responseReturn: 'raw',
  })

  const items = response.data.data
  const total = Number(response.headers['x-total-count'])
  return { items, total: Number.isFinite(total) ? total : items.length }
}

export function getSystemRoleOptionsApi() {
  return requestClient.get<SystemRole[]>('/admin/system/roles', {
    params: {
      mode: 'off',
      sorters: JSON.stringify([{ field: 'name', order: 'asc' }]),
    },
  })
}

export function createSystemRoleApi(data: CreateSystemRoleMutation) {
  return requestClient.post<SystemRole>('/admin/system/roles', data)
}

export function updateSystemRoleApi(id: string, data: SystemRoleMutation) {
  return requestClient.request<SystemRole>(`/admin/system/roles/${id}`, {
    data,
    method: 'PATCH',
  })
}

export function deleteSystemRoleApi(id: string) {
  return requestClient.delete<{ id: string }>(`/admin/system/roles/${id}`)
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
