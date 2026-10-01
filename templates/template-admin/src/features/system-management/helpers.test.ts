import { describe, expect, test } from 'vite-plus/test'

import type { SystemMenuApi, SystemRoleApi } from '@/api/core/system'
import {
  ALL_STATUS_VALUE,
  buildRolePermissionGroups,
  buildSaveRolePermissions,
  buildServerListQuery,
  buildSystemUserUpdateBody,
  countMenuSubtree,
  flattenMenuTree,
  getDirectRoleMenuIds,
  getDirectRolePermissions,
  hasRolePermission,
  mergeRolePermissions,
  removeRolePermissions,
  toggleRoleMenuSelection,
} from './helpers'

function menu(id: string, children?: SystemMenuApi.Node[]): SystemMenuApi.Node {
  return {
    id,
    parentId: null,
    type: 'menu',
    path: `/${id}`,
    title: id,
    description: null,
    icon: null,
    activePath: null,
    externalLink: null,
    iframeSrc: null,
    hideInBreadcrumb: false,
    hideInMenu: false,
    hideInTab: false,
    ignoreAccess: false,
    keepAlive: false,
    menuVisibleWithForbidden: false,
    order: 0,
    permissionCode: null,
    showActiveTabBorder: false,
    tabPath: null,
    status: 'ENABLED',
    createdAt: null,
    createdBy: null,
    updatedAt: null,
    updatedBy: null,
    accessScope: 'restricted',
    roleIds: ['admin'],
    children,
  }
}

function authorization(id: string, options: Partial<SystemRoleApi.MenuAuthorization['tree'][number]> = {}): SystemRoleApi.MenuAuthorization['tree'][number] {
  return {
    id,
    title: id,
    type: 'menu',
    status: 'ENABLED',
    accessScope: 'restricted',
    permissionCode: null,
    checked: false,
    direct: false,
    inherited: false,
    readOnly: false,
    ...options,
  }
}

describe('system management helpers', () => {
  test('only submits editable profile fields when updating a built-in user', () => {
    const form = {
      username: 'admin',
      nickName: 'Administrator',
      avatar: null,
      homePath: '/system/user',
      status: 'ENABLED' as const,
      roleIds: ['admin'],
    }

    expect(buildSystemUserUpdateBody(form, true)).toEqual({
      nickName: 'Administrator',
      avatar: null,
      homePath: '/system/user',
    })
    expect(buildSystemUserUpdateBody(form, false)).toEqual(form)
  })

  test('flattens only expanded branches and counts deletion impact', () => {
    const tree = [menu('root', [menu('child', [menu('leaf')])])]
    expect(countMenuSubtree(tree[0]!)).toBe(3)
    expect(flattenMenuTree(tree, new Set(['root'])).map(({ id, depth, descendantCount }) => ({ id, depth, descendantCount }))).toEqual([
      { id: 'root', depth: 0, descendantCount: 2 },
      { id: 'child', depth: 1, descendantCount: 1 },
    ])
  })

  test('cascades editable selections, fills ancestors, and preserves read-only inheritance', () => {
    const tree = [authorization('root', { children: [authorization('child'), authorization('inherited', { checked: true, inherited: true, readOnly: true })] })]
    const selected = toggleRoleMenuSelection(tree, ['inherited'], 'child', true)
    expect(selected).toEqual(['child', 'inherited', 'root'])
    expect(toggleRoleMenuSelection(tree, selected, 'root', false)).toEqual(['inherited'])
    expect(getDirectRoleMenuIds(tree, selected)).toEqual(['child', 'root'])
  })

  test('edits only direct API permissions and builds the full save payload', () => {
    const result: SystemRoleApi.PermissionResult = {
      permissions: [
        { resource: '/system/users', action: 'get', sourceRoleId: 'operator', direct: true, inherited: false },
        { resource: '/system/roles', action: 'GET', sourceRoleId: 'viewer', direct: false, inherited: true },
        { resource: '/system/users', action: 'GET', sourceRoleId: 'operator', direct: true, inherited: false },
      ],
      catalog: [],
      groupings: [{ child: 'operator', parent: 'viewer' }],
    }

    expect(getDirectRolePermissions(result)).toEqual([{ resource: '/system/users', action: 'GET' }])
    expect(hasRolePermission(result.permissions, { resource: ' /system/roles ', action: 'get' })).toBe(true)
    expect(
      buildSaveRolePermissions([
        { resource: ' /system/users ', action: 'post' },
        { resource: '/system/users', action: 'POST' },
      ]),
    ).toEqual([['/system/users', 'POST']])
  })

  test('groups the permission catalog and supports batch merge and removal', () => {
    const catalog = [
      { resource: '/system/users', action: 'GET', summary: '获取用户列表' },
      { resource: '/system/users/{id}', action: 'PATCH' },
      { resource: '/system/roles', action: 'GET' },
    ]
    const groups = buildRolePermissionGroups(catalog)
    expect(groups.map(({ id, label, permissions }) => ({ id, label, count: permissions.length }))).toEqual([
      { id: '/system/users', label: '用户管理', count: 2 },
      { id: '/system/roles', label: '角色管理', count: 1 },
    ])
    expect(groups.flatMap(({ permissions }) => permissions).find(({ resource }) => resource === '/system/users')).toMatchObject({ summary: '获取用户列表' })

    const inherited = [{ resource: '/system/users', action: 'GET' }]
    const merged = mergeRolePermissions([], catalog, inherited)
    expect(merged).toEqual([
      { resource: '/system/roles', action: 'GET' },
      { resource: '/system/users/{id}', action: 'PATCH' },
    ])
    expect(removeRolePermissions(merged, groups[0]!.permissions)).toEqual([{ resource: '/system/roles', action: 'GET' }])
  })

  test('builds serializable server pagination and filter parameters', () => {
    const query = buildServerListQuery({ page: 2, pageSize: 20, search: 'alice', searchFields: ['username', 'nickName'], status: 'ENABLED' })
    expect(query).toMatchObject({ current: 2, pageSize: 20, mode: 'server' })
    expect(JSON.parse(query.filters!)).toEqual([
      {
        operator: 'or',
        value: [
          { field: 'username', operator: 'contains', value: 'alice' },
          { field: 'nickName', operator: 'contains', value: 'alice' },
        ],
      },
      { field: 'status', operator: 'eq', value: 'ENABLED' },
    ])
  })

  test('uses a non-empty all-status value without sending it to the API', () => {
    expect(ALL_STATUS_VALUE).not.toBe('')
    const query = buildServerListQuery({ page: 1, pageSize: 10, searchFields: ['name'], status: ALL_STATUS_VALUE })
    expect(query.filters).toBeUndefined()
  })

  test('supports ascending server sorting', () => {
    const query = buildServerListQuery({ page: 1, pageSize: 10, searchFields: ['name'], sortField: 'createdAt', sortOrder: 'asc' })
    expect(JSON.parse(query.sorters!)).toEqual([{ field: 'createdAt', order: 'asc' }])
  })
})
