import { describe, expect, test } from 'vite-plus/test'

import type { SystemMenuApi, SystemRoleApi } from '@/api/core/system'
import { ALL_STATUS_VALUE, buildServerListQuery, buildSystemUserUpdateBody, countMenuSubtree, flattenMenuTree, getDirectRoleMenuIds, toggleRoleMenuSelection } from './helpers'

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
    contentMode: null,
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
