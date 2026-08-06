import { describe, expect, test } from 'vite-plus/test'

import type { AdminAccessMenuRecord } from '../access.helpers'
import { buildAdminAccessPayload } from '../access.helpers'

const rows: AdminAccessMenuRecord[] = [
  {
    id: 'public',
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
    expect(result.menus[0]?.children?.map(({ id }) => id)).toEqual(['public-page', 'visible-forbidden'])
    expect(result.menus[0]?.children?.[1]?.meta).toMatchObject({ authority: ['admin'], menuVisibleWithForbidden: true })
  })

  test('includes role-inherited routes, fills ancestors, and collects button permission codes', () => {
    const result = buildAdminAccessPayload(rows, ['operator', 'admin'])

    expect(result.permissionCodes).toEqual(['admin:create'])
    expect(result.menus.map(({ id }) => id)).toEqual(['public', 'admin'])
    expect(result.menus[1]?.children?.map(({ id }) => id)).toEqual(['admin-page'])
    expect(result.menus[1]?.children?.[0]?.children).toBeUndefined()
  })
})
