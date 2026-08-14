import type { Role, RoleWithParents, SavePermissionsError, SavePermissionsResult, UpdateRoleParentsResult } from './roles.types'

import { eq, inArray } from 'drizzle-orm'

import { Effect } from 'effect'

import db from '@/db'
import { systemRoles } from '@/db/schema'
import { systemMenuRoles } from '@/db/schema'

import { withLock } from '@/lib/infrastructure'
import { enforcerPromise } from '@/lib/services/casbin'
import { buildMenuTree, loadMenuRows, replaceRoleMenuLinks } from '../menus/menus.helpers'
import type { RoleMenuAuthorizationNode } from './roles.schema'

type AdminRouteDefinition = {
  method: string | string[]
  path: string
  summary?: string
  tags?: string[]
}

const adminRouteModules = import.meta.glob<Record<string, unknown>>('/src/routes/admin/**/*.routes.ts', { eager: true })

function isAdminRouteDefinition(value: unknown): value is AdminRouteDefinition {
  if (typeof value !== 'object' || value === null) return false
  const route = value as Partial<AdminRouteDefinition>
  return typeof route.path === 'string' && (typeof route.method === 'string' || (Array.isArray(route.method) && route.method.every((method) => typeof method === 'string')))
}

export function getAdminPermissionCatalog() {
  const catalog = Object.values(adminRouteModules)
    .flatMap((module) => Object.values(module))
    .filter(isAdminRouteDefinition)
    .filter(({ path }) => !path.startsWith('/auth'))
    .flatMap((route) =>
      (Array.isArray(route.method) ? route.method : [route.method]).map((method) => ({
        resource: route.path,
        action: method.toUpperCase(),
        summary: route.summary ?? route.path,
        group: route.tags?.[0] ?? '其他',
      })),
    )

  return [...new Map(catalog.map((item) => [`${item.resource}\u0000${item.action}`, item])).values()].sort((a, b) => `${a.resource}\u0000${a.action}`.localeCompare(`${b.resource}\u0000${b.action}`))
}

/**
 * Get all parent roles for a role
 * @param roleId Role ID / 角色ID
 * @returns Parent role ID array / 上级角色ID数组
 * 获取角色的所有上级角色
 */
export async function getRoleParents(roleId: string): Promise<string[]> {
  const enforcer = await enforcerPromise
  return enforcer.getRolesForUser(roleId)
}

/**
 * Set parent roles for a role (clears existing relationships first)
 * @param roleId Role ID / 角色ID
 * @param parentIds New parent role ID array / 新的上级角色ID数组
 * 设置角色的上级角色（会先清除原有关系）
 */
export async function setRoleParents(roleId: string, parentIds: string[]): Promise<void> {
  await Effect.runPromise(
    withLock(
      `role:${roleId}:inheritance`,
      Effect.promise(async () => {
        const enforcer = await enforcerPromise

        // Remove all existing parent role relationships first / 先移除所有现有的上级角色关系
        await enforcer.removeFilteredGroupingPolicy(0, roleId)

        // If there are new parent roles, add them in batch / 如果有新的上级角色，批量添加
        if (parentIds.length > 0) {
          const rules = parentIds.map((parentId) => [roleId, parentId])
          await enforcer.addGroupingPolicies(rules)
        }
      }),
    ),
  )
}

/**
 * Check if circular inheritance would occur
 * @param roleId Current role ID / 当前角色ID
 * @param parentIds Parent role IDs to set / 要设置的上级角色ID数组
 * @returns true if circular, false if normal / true表示会产生循环，false表示正常
 * 检查是否会产生循环继承
 */
export async function checkCircularInheritance(roleId: string, parentIds: string[]): Promise<boolean> {
  const enforcer = await enforcerPromise

  // Get all role inheritance relationships at once to avoid multiple enforcer calls during recursion / 一次性获取所有角色继承关系，避免递归中多次调用 enforcer
  const allGroupingPolicies = await enforcer.getGroupingPolicy()

  // Build local map: child -> parents / 构建本地图：child -> parents
  const parentMap = new Map<string, string[]>()
  for (const [child, parent] of allGroupingPolicies) {
    if (!parentMap.has(child)) {
      parentMap.set(child, [])
    }
    parentMap.get(child)!.push(parent)
  }

  // Use local map for DFS cycle detection / 使用本地图进行 DFS 检查循环
  const hasCycle = (currentId: string, visited: Set<string>): boolean => {
    if (visited.has(currentId)) return false
    visited.add(currentId)

    const parents = parentMap.get(currentId) || []
    for (const parent of parents) {
      if (parent === roleId) return true
      if (hasCycle(parent, visited)) return true
    }
    return false
  }

  // Check each parent role to be set / 检查每个要设置的上级角色
  for (const parentId of parentIds) {
    // Cannot be its own parent / 自己不能是自己的上级
    if (parentId === roleId) return true
    // Check if ancestor chain contains roleId / 检查祖先链中是否包含 roleId
    if (hasCycle(parentId, new Set<string>())) return true
  }

  return false
}

/**
 * Enrich a single role object with parent role info
 * @param role Role object / 角色对象
 * @returns Role object with parent role info / 包含上级角色信息的角色对象
 * 为单个角色对象添加上级角色信息
 */
export async function enrichRoleWithParents(role: Role): Promise<RoleWithParents> {
  const parentRoles = await getRoleParents(role.id)
  return { ...role, parentRoles }
}

/**
 * Batch enrich role list with parent role info
 * @param roles Role list / 角色列表
 * @returns Role list with parent role info / 包含上级角色信息的角色列表
 * 批量为角色列表添加上级角色信息
 */
export async function enrichRolesWithParents(roles: Role[]): Promise<RoleWithParents[]> {
  const enforcer = await enforcerPromise

  // Get all role inheritance relationships / 获取所有的角色继承关系
  const allGroupingPolicies = await enforcer.getGroupingPolicy()

  // Build mapping from role ID to parent roles / 构建角色ID到上级角色的映射
  const parentMap = new Map<string, string[]>()
  for (const [child, parent] of allGroupingPolicies) {
    if (!parentMap.has(child)) {
      parentMap.set(child, [])
    }
    parentMap.get(child)!.push(parent)
  }

  // Add parent role info for each role / 为每个角色添加上级角色信息
  return roles.map((role) => ({
    ...role,
    parentRoles: parentMap.get(role.id) || [],
  }))
}

/**
 * Clean up all inheritance relationships for a role (used when deleting a role)
 * @param roleId Role ID / 角色ID
 * 清理角色的所有继承关系（删除角色时使用）
 */
export async function cleanRoleInheritance(roleId: string): Promise<void> {
  const enforcer = await enforcerPromise

  // Delete relationships as child role (roleId inherits from other roles) / 删除作为子角色的关系（roleId继承自其他角色）
  await enforcer.removeFilteredGroupingPolicy(0, roleId)

  // Delete relationships as parent role (other roles inherit from roleId) / 删除作为父角色的关系（其他角色继承自roleId）
  await enforcer.removeFilteredGroupingPolicy(1, roleId)
}

export async function cleanRoleAuthorization(roleId: string): Promise<void> {
  const enforcer = await enforcerPromise
  await enforcer.deleteRole(roleId)
}

/**
 * Validate parent roles exist
 * @returns null if all exist, otherwise returns list of non-existent role IDs / null 表示验证通过，否则返回不存在的角色 ID 列表
 * 验证父角色是否存在
 */
export async function validateParentRolesExist(parentRoleIds: string[]): Promise<string[] | null> {
  if (parentRoleIds.length === 0) return null

  const existingParents = await db.select({ id: systemRoles.id }).from(systemRoles).where(inArray(systemRoles.id, parentRoleIds))

  if (existingParents.length === parentRoleIds.length) return null

  const existingIds = new Set(existingParents.map((r) => r.id))
  return parentRoleIds.filter((pid) => !existingIds.has(pid))
}

/**
 * Update role's parent role relationships
 * @returns { success: true } or { success: false, error: string } / { success: true } 或 { success: false, error: string }
 * 更新角色的父角色关系
 */
export async function updateRoleParents(roleId: string, parentRoleIds: string[]): Promise<UpdateRoleParentsResult> {
  if (parentRoleIds.length > 0) {
    const hasCircular = await checkCircularInheritance(roleId, parentRoleIds)
    if (hasCircular) {
      return { success: false, error: '设置的上级角色会产生循环继承' }
    }

    const invalidIds = await validateParentRolesExist(parentRoleIds)
    if (invalidIds) {
      return { success: false, error: `上级角色不存在: ${invalidIds.join(', ')}` }
    }
  }

  await setRoleParents(roleId, parentRoleIds)
  return { success: true }
}

/**
 * Get role by ID
 * 根据 ID 获取角色
 */
export async function getRoleById(id: string) {
  const [role] = await db.select().from(systemRoles).where(eq(systemRoles.id, id))
  return role ?? null
}

/**
 * Check if role exists
 * 检查角色是否存在
 */
export async function roleExists(id: string): Promise<boolean> {
  const [role] = await db.select({ id: systemRoles.id }).from(systemRoles).where(eq(systemRoles.id, id)).limit(1)
  return !!role
}

/**
 * Save role permissions
 * 保存角色权限
 */
export async function saveRolePermissions(roleId: string, permissions: Array<[string, string]>): Promise<SavePermissionsResult | SavePermissionsError> {
  return Effect.runPromise(
    withLock(
      `role:${roleId}:permissions`,
      Effect.promise(async () => {
        const enforcer = await enforcerPromise

        // Get role's direct permissions (excluding inherited) / 获取角色的直接权限（不包括继承的）
        const directPermissions = await enforcer.getPermissionsForUser(roleId.toString())

        // Get all implicit permissions (including inherited) / 获取所有隐式权限（包括继承的）
        const allImplicitPermissions = await enforcer.getImplicitPermissionsForUser(roleId.toString())
        const directPermSet = new Set(directPermissions.map((p) => `${p[1]}:${p[2]}`))
        const inheritedPermSet = new Set(allImplicitPermissions.filter((p) => !directPermSet.has(`${p[1]}:${p[2]}`)).map((p) => `${p[1]}:${p[2]}`))

        // Check if attempting to add already inherited permissions / 检查是否尝试添加已经继承的权限
        const duplicateInheritedPerms: string[] = []
        for (const [resource, action] of permissions) {
          const key = `${resource}:${action}`
          if (inheritedPermSet.has(key)) {
            duplicateInheritedPerms.push(key)
          }
        }

        if (duplicateInheritedPerms.length > 0) {
          return {
            success: false,
            error: `不能重复添加已继承的权限: ${duplicateInheritedPerms.join(', ')}`,
          } as SavePermissionsError
        }

        // Build new permissions in array format / 构建新权限的数组格式
        const oldPolicies = directPermissions
        const newPolicies = permissions.map(([resource, action]) => [roleId.toString(), resource, action])

        let removedCount = 0
        let addedCount = 0

        // Delete all existing direct permissions / 删除所有现有直接权限
        if (oldPolicies.length > 0) {
          const removeSuccess = await enforcer.removePolicies(oldPolicies)
          if (!removeSuccess) {
            return { success: false, error: '删除旧权限失败' } as SavePermissionsError
          }
          removedCount = oldPolicies.length
        }

        // Add new permissions / 添加新权限
        if (newPolicies.length > 0) {
          try {
            const addSuccess = await enforcer.addPolicies(newPolicies)
            if (!addSuccess) {
              // Add failed, attempt rollback / 添加失败，尝试回滚
              if (oldPolicies.length > 0) {
                await enforcer.addPolicies(oldPolicies)
              }
              return { success: false, error: '添加新权限失败' } as SavePermissionsError
            }
            addedCount = newPolicies.length
          } catch {
            // Add exception, attempt rollback / 添加异常，尝试回滚
            if (oldPolicies.length > 0) {
              try {
                await enforcer.addPolicies(oldPolicies)
              } catch {
                // Rollback also failed / 回滚也失败
              }
            }
            throw new Error('添加新权限时发生异常')
          }
        }

        return { success: true, added: addedCount, removed: removedCount, total: newPolicies.length } as SavePermissionsResult
      }),
    ),
  )
}

/**
 * Get role's permissions and inheritance relationships
 * 获取角色的权限和继承关系
 */
export async function getRolePermissionsAndGroupings(roleId: string) {
  const enforcer = await enforcerPromise

  // Get all implicit permissions (including inherited) / 获取所有隐式权限（包括继承的）
  const [allImplicitPermissions, directPermissions] = await Promise.all([enforcer.getImplicitPermissionsForUser(roleId), enforcer.getPermissionsForUser(roleId)])
  const directKeys = new Set(directPermissions.map((permission) => `${permission[1]}\u0000${permission[2]}`))

  const permissions = allImplicitPermissions.map((p) => ({
    resource: p[1],
    action: p[2],
    sourceRoleId: p[0],
    direct: p[0] === roleId && directKeys.has(`${p[1]}\u0000${p[2]}`),
    inherited: p[0] !== roleId,
  }))

  // Get all role inheritance relationships / 获取所有角色继承关系
  const allGroupings = await enforcer.getGroupingPolicy()
  const groupings = allGroupings.map((g) => ({
    child: g[0],
    parent: g[1],
  }))

  return { permissions, catalog: getAdminPermissionCatalog(), groupings }
}

export async function getRoleMenuAuthorization(roleId: string) {
  const role = await getRoleById(roleId)
  if (!role) return null

  const [rows, inheritedRoles] = await Promise.all([loadMenuRows(), resolveInheritedRoleIds(roleId)])
  const inheritedRoleSet = new Set(inheritedRoles)
  const directMenuIds = rows.filter(({ roleIds }) => roleIds.includes(roleId)).map(({ id }) => id)
  const inheritedMenuIds = rows.filter(({ roleIds }) => roleIds.some((id) => inheritedRoleSet.has(id))).map(({ id }) => id)
  const directSet = new Set(directMenuIds)
  const inheritedSet = new Set(inheritedMenuIds)
  const managementTree = buildMenuTree(rows)

  const mapNode = (node: (typeof managementTree)[number]): RoleMenuAuthorizationNode => {
    const direct = directSet.has(node.id)
    const inherited = inheritedSet.has(node.id)
    const isPublic = node.accessScope === 'public'
    const children = node.children?.map(mapNode)
    return {
      id: node.id,
      title: node.title,
      type: node.type,
      status: node.status,
      accessScope: node.accessScope,
      permissionCode: node.permissionCode ?? null,
      checked: isPublic || direct || inherited || roleId === 'admin',
      direct,
      inherited,
      readOnly: roleId === 'admin' || isPublic || inherited,
      ...(children && children.length > 0 ? { children } : {}),
    }
  }

  const menuIds = rows.filter(({ id, roleIds, type }) => type !== 'group' && (roleIds.length === 0 || directSet.has(id) || inheritedSet.has(id) || roleId === 'admin')).map(({ id }) => id)
  return {
    roleId,
    readOnly: roleId === 'admin',
    menuIds: [...new Set(menuIds)].sort(),
    directMenuIds: [...new Set(directMenuIds)].sort(),
    inheritedMenuIds: [...new Set(inheritedMenuIds)].sort(),
    tree: managementTree.map(mapNode),
  }
}

export async function saveRoleMenus(roleId: string, requestedMenuIds: readonly string[]) {
  const role = await getRoleById(roleId)
  if (!role) return { success: false as const, status: 'not_found' as const, error: '角色不存在' }
  if (roleId === 'admin') return { success: false as const, status: 'forbidden' as const, error: 'admin 角色授权不允许修改' }

  const [rows, inheritedRoles] = await Promise.all([loadMenuRows(), resolveInheritedRoleIds(roleId)])
  const rowMap = new Map(rows.map((row) => [row.id, row]))
  const missingIds = [...new Set(requestedMenuIds)].filter((id) => !rowMap.has(id))
  if (missingIds.length > 0) return { success: false as const, status: 'not_found' as const, error: `菜单不存在: ${missingIds.join(', ')}` }

  const inheritedRoleSet = new Set(inheritedRoles)
  const inheritedMenuSet = new Set(rows.filter(({ roleIds }) => roleIds.some((id) => inheritedRoleSet.has(id))).map(({ id }) => id))
  const directIds = new Set<string>()

  for (const requestedId of requestedMenuIds) {
    let current = rowMap.get(requestedId)
    const visited = new Set<string>()
    while (current && !visited.has(current.id)) {
      visited.add(current.id)
      if (current.roleIds.length > 0 && !inheritedMenuSet.has(current.id)) directIds.add(current.id)
      current = current.parentId ? rowMap.get(current.parentId) : undefined
    }
  }

  const menuIds = [...directIds].sort()
  await replaceRoleMenuLinks(roleId, menuIds)

  const restrictedIds = rows.filter(({ roleIds, type }) => type !== 'group' && roleIds.length > 0).map(({ id }) => id)
  if (restrictedIds.length > 0) {
    await db
      .insert(systemMenuRoles)
      .values(restrictedIds.map((menuId) => ({ menuId, roleId: 'admin' })))
      .onConflictDoNothing()
  }

  return { success: true as const, menuIds, total: menuIds.length }
}

export async function resolveInheritedRoleIds(roleId: string): Promise<string[]> {
  const enforcer = await enforcerPromise
  return enforcer.getImplicitRolesForUser(roleId)
}
