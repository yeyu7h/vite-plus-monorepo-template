import type { SystemMenuApi, SystemRoleApi } from '@/api/core/system'
import type { ListQuery } from '@/api/core/system'

export const ALL_STATUS_VALUE = 'ALL' as const

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
