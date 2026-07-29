import type { AdminMenuIcon, AdminMenuType } from '@monorepo-admin-core/types'

import { requestClient } from './request'

export interface SystemMenuGroup {
  createdAt: null | string
  createdBy: null | string
  id: string
  name: string
  order: number
  updatedAt: null | string
  updatedBy: null | string
}

export interface SystemMenuNode {
  action: null | string
  activePath: null | string
  children: SystemMenuNode[]
  contentMode: 'default' | 'full' | null
  createdAt: null | string
  createdBy: null | string
  description: null | string
  externalLink: null | string
  groupId: null | string
  hideInBreadcrumb: boolean
  hideInMenu: boolean
  hideInTab: boolean
  icon: AdminMenuIcon | null
  id: string
  iframeSrc: null | string
  ignoreAccess: boolean
  keepAlive: boolean
  menuVisibleWithForbidden: boolean
  order: number
  parentId: null | string
  path: null | string
  permissionCode: null | string
  resource: null | string
  showActiveTabBorder: boolean
  tabPath: null | string
  title: string
  type: AdminMenuType
  updatedAt: null | string
  updatedBy: null | string
}

export interface SystemMenuMutation {
  action?: null | string
  activePath?: null | string
  contentMode?: 'default' | 'full' | null
  description?: null | string
  externalLink?: null | string
  groupId?: null | string
  hideInBreadcrumb?: boolean
  hideInMenu?: boolean
  hideInTab?: boolean
  icon?: AdminMenuIcon | null
  iframeSrc?: null | string
  ignoreAccess?: boolean
  keepAlive?: boolean
  menuVisibleWithForbidden?: boolean
  order?: number
  parentId?: null | string
  path?: null | string
  permissionCode?: null | string
  resource?: null | string
  showActiveTabBorder?: boolean
  tabPath?: null | string
  title?: string
  type?: AdminMenuType
}

export function getMenuGroupsApi() {
  return requestClient.get<SystemMenuGroup[]>('/admin/system/menu-groups')
}

export function createMenuGroupApi(data: Pick<SystemMenuGroup, 'name' | 'order'>) {
  return requestClient.post<SystemMenuGroup>('/admin/system/menu-groups', data)
}

export function updateMenuGroupApi(id: string, data: Partial<Pick<SystemMenuGroup, 'name' | 'order'>>) {
  return requestClient.request<SystemMenuGroup>(`/admin/system/menu-groups/${id}`, { data, method: 'PATCH' })
}

export function deleteMenuGroupApi(id: string) {
  return requestClient.delete<{ id: string }>(`/admin/system/menu-groups/${id}`)
}

export function getMenuTreeApi() {
  return requestClient.get<SystemMenuNode[]>('/admin/system/menus/tree')
}

export function createMenuApi(data: SystemMenuMutation) {
  return requestClient.post<SystemMenuNode>('/admin/system/menus', data)
}

export function createChildMenuApi(parentId: string, data: SystemMenuMutation) {
  return requestClient.post<SystemMenuNode>(`/admin/system/menus/${parentId}/children`, data)
}

export function updateMenuApi(id: string, data: SystemMenuMutation) {
  return requestClient.request<SystemMenuNode>(`/admin/system/menus/${id}`, { data, method: 'PATCH' })
}

export function deleteMenuApi(id: string) {
  return requestClient.delete<{ id: string }>(`/admin/system/menus/${id}`)
}
