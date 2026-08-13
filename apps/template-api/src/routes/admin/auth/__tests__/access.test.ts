import { describe, expect, test } from 'vite-plus/test'

import type { AdminAccessMenuRecord } from '../access.helpers'
import { buildAdminAccessPayload } from '../access.helpers'

const rows: AdminAccessMenuRecord[] = [
  {
    id: 'workspace-group',
    order: 10,
    path: null,
    roleIds: [],
    title: '工作台',
    type: 'group',
  },
  {
    id: 'public',
    parentId: 'workspace-group',
    order: 1,
    path: '/public',
    roleIds: [],
    title: '公共',
    type: 'directory',
  },
  {
    id: 'public-page',
    parentId: 'public',
    path: 'page',
    roleIds: [],
    title: '公共页面',
    type: 'menu',
  },
  {
    id: 'visible-forbidden',
    parentId: 'public',
    path: 'forbidden',
    menuVisibleWithForbidden: true,
    roleIds: ['admin'],
    title: '可见但无权限',
    type: 'menu',
  },
  {
    id: 'admin',
    order: 2,
    path: '/admin',
    roleIds: ['admin'],
    title: '系统',
    type: 'directory',
  },
  {
    id: 'admin-page',
    parentId: 'admin',
    path: 'page',
    roleIds: ['admin'],
    title: '系统页面',
    type: 'menu',
  },
  {
    id: 'admin-button',
    parentId: 'admin-page',
    path: 'create',
    permissionCode: 'admin:create',
    roleIds: ['admin'],
    title: '创建',
    type: 'button',
  },
]

describe('buildAdminAccessPayload', () => {
  test('returns public menus and visible forbidden entries without leaking restricted routes', () => {
    const result = buildAdminAccessPayload(rows, ['user'])

    expect(result.permissionCodes).toEqual([])
    expect(result.menus.map(({ id }) => id)).toEqual(['public'])
    expect(result.menus[0]?.meta.group).toEqual({ id: 'workspace-group', label: '工作台', order: 10 })
    expect(result.menus[0]?.children?.map(({ id }) => id)).toEqual(['public-page', 'visible-forbidden'])
    expect(result.menus[0]?.children?.[1]?.meta).toMatchObject({ authority: ['admin'], menuVisibleWithForbidden: true })
  })

  test('includes role-inherited routes, fills ancestors, and returns the admin permission wildcard', () => {
    const result = buildAdminAccessPayload(rows, ['operator', 'admin'])

    expect(result.permissionCodes).toEqual(['*:*:*'])
    expect(result.menus.map(({ id }) => id)).toEqual(['public', 'admin'])
    expect(result.menus[1]?.children?.map(({ id }) => id)).toEqual(['admin-page'])
    expect(result.menus[1]?.children?.[0]?.children).toBeUndefined()
  })

  test('collects explicit button permission codes for non-admin roles', () => {
    const nonAdminRows = rows.map((row) => ({ ...row, roleIds: row.roleIds.map((roleId) => (roleId === 'admin' ? 'operator' : roleId)) }))

    expect(buildAdminAccessPayload(nonAdminRows, ['operator']).permissionCodes).toEqual(['admin:create'])
  })

  test('hides complete subtrees when an ancestor menu or group node is disabled', () => {
    const hiddenRows: AdminAccessMenuRecord[] = [
      { id: 'disabled-root', path: '/disabled', roleIds: [], status: 'DISABLED', title: '禁用根', type: 'directory' },
      { id: 'disabled-child', parentId: 'disabled-root', path: 'child', roleIds: [], title: '子页面', type: 'menu' },
      {
        id: 'disabled-group',
        path: null,
        roleIds: [],
        status: 'DISABLED',
        title: '禁用分组',
        type: 'group',
      },
      {
        id: 'group-root',
        parentId: 'disabled-group',
        path: '/group',
        roleIds: [],
        title: '分组根',
        type: 'directory',
      },
      { id: 'group-child', parentId: 'group-root', path: 'child', roleIds: [], title: '分组子页面', type: 'menu' },
      { id: 'enabled', path: '/enabled', roleIds: [], title: '正常页面', type: 'menu' },
    ]

    expect(buildAdminAccessPayload(hiddenRows, []).menus.map(({ id }) => id)).toEqual(['enabled'])
  })
})
