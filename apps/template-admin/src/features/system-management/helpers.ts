import type { SystemMenuApi, SystemRoleApi, SystemUserApi } from '@/api/core/system'
import type { ListQuery } from '@/api/core/system'

export const ALL_STATUS_VALUE = 'ALL' as const

export type RolePermissionInput = { resource: string; action: string; summary?: string }
export type RolePermissionGroup = { id: string; label: string; permissions: RolePermissionInput[] }

const ROLE_PERMISSION_GROUP_LABELS: Record<string, string> = {
  '/resources/object-storage': '对象存储',
  '/system/dicts': '字典管理',
  '/system/menus': '菜单管理',
  '/system/params': '参数管理',
  '/system/roles': '角色管理',
  '/system/users': '用户管理',
}

type SystemUserUpdateForm = Required<Pick<SystemUserApi.UpdateBody, 'avatar' | 'homePath' | 'nickName' | 'roleIds' | 'status' | 'username'>>

export function buildSystemUserUpdateBody(form: SystemUserUpdateForm, builtIn: boolean): SystemUserApi.UpdateBody {
  const editableFields = {
    nickName: form.nickName,
    avatar: form.avatar,
    homePath: form.homePath,
  }

  if (builtIn) return editableFields

  return {
    ...editableFields,
    username: form.username,
    status: form.status,
    roleIds: form.roleIds,
  }
}

export type FlatMenuRow = SystemMenuApi.Node & { depth: number; descendantCount: number }

export function countMenuSubtree(node: SystemMenuApi.Node): number {
  return 1 + (node.children ?? []).reduce((total, child) => total + countMenuSubtree(child), 0)
}

export function flattenMenuTree(nodes: readonly SystemMenuApi.Node[], expandedIds: ReadonlySet<string>, depth = 0): FlatMenuRow[] {
  return nodes.flatMap((node) => {
    const row: FlatMenuRow = { ...node, depth, descendantCount: countMenuSubtree(node) - 1 }
    if (!expandedIds.has(node.id)) return [row]
    return [row, ...flattenMenuTree(node.children ?? [], expandedIds, depth + 1)]
  })
}

type AuthorizationNode = SystemRoleApi.MenuAuthorization['tree'][number]

export function toggleRoleMenuSelection(tree: readonly AuthorizationNode[], selectedIds: readonly string[], targetId: string, checked: boolean): string[] {
  const selected = new Set(selectedIds)
  const nodes = new Map<string, AuthorizationNode>()
  const parents = new Map<string, string>()

  const visit = (items: readonly AuthorizationNode[], parentId?: string) => {
    for (const item of items) {
      nodes.set(item.id, item)
      if (parentId) parents.set(item.id, parentId)
      visit(item.children ?? [], item.id)
    }
  }
  visit(tree)

  const target = nodes.get(targetId)
  if (!target || target.readOnly) return [...selected].sort()

  const toggleDescendants = (node: AuthorizationNode) => {
    if (!node.readOnly) {
      if (checked) selected.add(node.id)
      else selected.delete(node.id)
    }
    for (const child of node.children ?? []) toggleDescendants(child)
  }
  toggleDescendants(target)

  if (checked) {
    let parentId = parents.get(targetId)
    while (parentId) {
      const parent = nodes.get(parentId)
      if (parent && !parent.readOnly) selected.add(parentId)
      parentId = parents.get(parentId)
    }
  }

  return [...selected].sort()
}

export function getDirectRoleMenuIds(tree: readonly AuthorizationNode[], selectedIds: readonly string[]): string[] {
  const selected = new Set(selectedIds)
  const result: string[] = []
  const visit = (items: readonly AuthorizationNode[]) => {
    for (const item of items) {
      if (selected.has(item.id) && !item.readOnly && item.accessScope === 'restricted') result.push(item.id)
      visit(item.children ?? [])
    }
  }
  visit(tree)
  return result.sort()
}

function rolePermissionKey(permission: RolePermissionInput): string {
  return `${permission.resource}\u0000${permission.action}`
}

export function normalizeRolePermission(permission: RolePermissionInput): RolePermissionInput {
  const resource = permission.resource.trim()
  const action = permission.action.trim().toUpperCase()
  const summary = permission.summary?.trim()
  return summary ? { resource, action, summary } : { resource, action }
}

export function getDirectRolePermissions(result: SystemRoleApi.PermissionResult): RolePermissionInput[] {
  const permissions = result.permissions.filter(({ direct }) => direct).map(normalizeRolePermission)
  return [...new Map(permissions.map((permission) => [rolePermissionKey(permission), permission])).values()].sort((a, b) => rolePermissionKey(a).localeCompare(rolePermissionKey(b)))
}

export function hasRolePermission(permissions: readonly RolePermissionInput[], candidate: RolePermissionInput): boolean {
  const candidateKey = rolePermissionKey(normalizeRolePermission(candidate))
  return permissions.some((permission) => rolePermissionKey(normalizeRolePermission(permission)) === candidateKey)
}

export function buildSaveRolePermissions(permissions: readonly RolePermissionInput[]): SystemRoleApi.SavePermissionsBody['permissions'] {
  const normalized = permissions.map(normalizeRolePermission).filter(({ resource, action }) => resource && action)
  return [...new Map(normalized.map((permission) => [rolePermissionKey(permission), [permission.resource, permission.action] as [string, string]])).values()].sort((a, b) =>
    `${a[0]}\u0000${a[1]}`.localeCompare(`${b[0]}\u0000${b[1]}`),
  )
}

export function mergeRolePermissions(current: readonly RolePermissionInput[], candidates: readonly RolePermissionInput[], blocked: readonly RolePermissionInput[] = []): RolePermissionInput[] {
  const result = current.map(normalizeRolePermission)
  for (const candidate of candidates.map(normalizeRolePermission)) {
    if (!candidate.resource || !candidate.action || hasRolePermission([...result, ...blocked], candidate)) continue
    result.push(candidate)
  }
  return result.sort((a, b) => rolePermissionKey(a).localeCompare(rolePermissionKey(b)))
}

export function removeRolePermissions(current: readonly RolePermissionInput[], candidates: readonly RolePermissionInput[]): RolePermissionInput[] {
  return current.filter((permission) => !hasRolePermission(candidates, permission))
}

export function buildRolePermissionGroups(catalog: readonly RolePermissionInput[]): RolePermissionGroup[] {
  const groups = new Map<string, RolePermissionInput[]>()
  for (const permission of mergeRolePermissions([], catalog)) {
    const segments = permission.resource.split('/').filter(Boolean)
    const depth = segments[0] === 'system' ? 2 : Math.min(2, segments.length)
    const id = `/${segments.slice(0, depth).join('/')}`
    const permissions = groups.get(id) ?? []
    permissions.push(permission)
    groups.set(id, permissions)
  }
  return [...groups.entries()].map(([id, permissions]) => ({ id, label: ROLE_PERMISSION_GROUP_LABELS[id] ?? id, permissions })).sort((a, b) => a.label.localeCompare(b.label))
}

export function buildServerListQuery(options: { page: number; pageSize: number; search?: string; searchFields: string[]; status?: string; sortField?: string; sortOrder?: 'asc' | 'desc' }): ListQuery {
  const filters: unknown[] = []
  const search = options.search?.trim()
  if (search) {
    filters.push({ operator: 'or', value: options.searchFields.map((field) => ({ field, operator: 'contains', value: search })) })
  }
  if (options.status && options.status !== ALL_STATUS_VALUE) filters.push({ field: 'status', operator: 'eq', value: options.status })

  return {
    current: options.page,
    pageSize: options.pageSize,
    mode: 'server',
    filters: filters.length > 0 ? JSON.stringify(filters) : undefined,
    sorters: JSON.stringify([{ field: options.sortField ?? 'createdAt', order: options.sortOrder ?? 'desc' }]),
  }
}

export function getApiErrorMessage(error: unknown, fallback = '操作失败') {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string' && error.message) return error.message
  return fallback
}
