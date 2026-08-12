import type { RequestResponse } from '@monorepo/request'
import type { components, paths } from '#/openapi/admin'

import { client } from '@/api/request'

type ResponseData<Operation extends { responses: Record<number, unknown> }, Status extends keyof Operation['responses']> = Operation['responses'][Status] extends {
  content: { 'application/json': { data: infer Data } }
}
  ? Data
  : never

type RequestBody<Operation> = Operation extends { requestBody: { content: { 'application/json': infer Body } } } ? Body : never

type MenusCreateOperation = paths['/api/admin/system/menus']['post']
type MenusUpdateOperation = paths['/api/admin/system/menus/{id}']['patch']
type MenusDeleteOperation = paths['/api/admin/system/menus/{id}']['delete']
type RolesListOperation = paths['/api/admin/system/roles']['get']
type RolesCreateOperation = paths['/api/admin/system/roles']['post']
type RolesUpdateOperation = paths['/api/admin/system/roles/{id}']['patch']
type RolesMenusOperation = paths['/api/admin/system/roles/{id}/menus']['get']
type RolesSaveMenusOperation = paths['/api/admin/system/roles/{id}/menus']['put']
type RolesPermissionsOperation = paths['/api/admin/system/roles/{id}/permissions']['get']
type UsersListOperation = paths['/api/admin/system/users']['get']
type UsersCreateOperation = paths['/api/admin/system/users']['post']
type UsersUpdateOperation = paths['/api/admin/system/users/{id}']['patch']

export type ListQuery = {
  current?: number
  pageSize?: number
  mode?: 'server' | 'client' | 'off'
  filters?: string
  sorters?: string
}

export namespace SystemMenuApi {
  export type Node = components['schemas']['AdminMenuManagementNode']
  export type CreateBody = RequestBody<MenusCreateOperation>
  export type UpdateBody = RequestBody<MenusUpdateOperation>
  export type DeleteResult = ResponseData<MenusDeleteOperation, 200>
}

export namespace SystemRoleApi {
  export type Item = ResponseData<RolesListOperation, 200>[number]
  export type CreateBody = RequestBody<RolesCreateOperation>
  export type UpdateBody = RequestBody<RolesUpdateOperation>
  export type MenuAuthorization = ResponseData<RolesMenusOperation, 200>
  export type SaveMenusBody = RequestBody<RolesSaveMenusOperation>
  export type PermissionResult = ResponseData<RolesPermissionsOperation, 200>
}

export namespace SystemUserApi {
  export type Item = ResponseData<UsersListOperation, 200>[number]
  export type CreateBody = RequestBody<UsersCreateOperation>
  export type UpdateBody = RequestBody<UsersUpdateOperation>
}

type Envelope<T> = { data: T }

async function getPaginated<T>(url: string, query: ListQuery) {
  const response = await client.get<RequestResponse<Envelope<T[]>>>(url, { params: query, responseReturn: 'raw' })
  return {
    items: response.data.data,
    total: Number(response.headers['x-total-count'] ?? response.data.data.length),
  }
}

export const systemMenuApi = {
  getTree: () => client.get<SystemMenuApi.Node[]>('/admin/system/menus/tree'),
  create: (data: SystemMenuApi.CreateBody) => client.post<SystemMenuApi.Node>('/admin/system/menus', data),
  update: (id: string, data: SystemMenuApi.UpdateBody) => client.patch<SystemMenuApi.Node>(`/admin/system/menus/${id}`, data),
  delete: (id: string) => client.delete<SystemMenuApi.DeleteResult>(`/admin/system/menus/${id}`),
}

export const systemRoleApi = {
  list: (query: ListQuery) => getPaginated<SystemRoleApi.Item>('/admin/system/roles', query),
  create: (data: SystemRoleApi.CreateBody) => client.post<SystemRoleApi.Item>('/admin/system/roles', data),
  update: (id: string, data: SystemRoleApi.UpdateBody) => client.patch<SystemRoleApi.Item>(`/admin/system/roles/${id}`, data),
  delete: (id: string) => client.delete<{ id: string }>(`/admin/system/roles/${id}`),
  getMenus: (id: string) => client.get<SystemRoleApi.MenuAuthorization>(`/admin/system/roles/${id}/menus`),
  saveMenus: (id: string, data: SystemRoleApi.SaveMenusBody) => client.put<{ total: number; menuIds: string[] }>(`/admin/system/roles/${id}/menus`, data),
  getPermissions: (id: string) => client.get<SystemRoleApi.PermissionResult>(`/admin/system/roles/${id}/permissions`),
}

export const systemUserApi = {
  list: (query: ListQuery) => getPaginated<SystemUserApi.Item>('/admin/system/users', query),
  create: (data: SystemUserApi.CreateBody) => client.post<SystemUserApi.Item>('/admin/system/users', data),
  update: (id: string, data: SystemUserApi.UpdateBody) => client.patch<SystemUserApi.Item>(`/admin/system/users/${id}`, data),
  delete: (id: string) => client.delete<{ id: string }>(`/admin/system/users/${id}`),
}
