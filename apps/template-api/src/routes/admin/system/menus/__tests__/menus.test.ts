import { describe, expect, test } from 'vite-plus/test'

import { Status } from '@/lib/enums'

import { buildMenuTree, collectMenuSubtreeIds } from '../menus.helpers'

function menu(id: string, parentId: string | null, order: number, roleIds: string[] = []) {
  return {
    id,
    parentId,
    type: 'menu' as const,
    path: parentId ? id : `/${id}`,
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
    order,
    permissionCode: null,
    showActiveTabBorder: false,
    tabPath: null,
    status: Status.ENABLED,
    createdAt: null,
    createdBy: null,
    updatedAt: null,
    updatedBy: null,
    roleIds,
  }
}

describe('menu management helpers', () => {
  test('builds an ordered recursive management tree with access scopes', () => {
    const tree = buildMenuTree([menu('child-b', 'root', 20, ['admin']), menu('root', null, 10), menu('child-a', 'root', 10)])

    expect(tree).toHaveLength(1)
    expect(tree[0]).toMatchObject({ id: 'root', accessScope: 'public' })
    expect(tree[0]?.children?.map(({ id, accessScope }) => ({ id, accessScope }))).toEqual([
      { id: 'child-a', accessScope: 'public' },
      { id: 'child-b', accessScope: 'restricted' },
    ])
  })

  test('counts every node in a subtree exactly once', () => {
    const rows = [menu('root', null, 1), menu('child', 'root', 1), menu('leaf', 'child', 1), menu('other', null, 2)]
    expect(collectMenuSubtreeIds(rows, 'root').sort()).toEqual(['child', 'leaf', 'root'])
  })

  test('keeps group nodes as the ordered root of the management tree', () => {
    const group = { ...menu('workspace', null, 10), type: 'group' as const, path: null, title: '工作台' }
    const dashboard = { ...menu('dashboard', 'workspace', 20), path: '/dashboard' }
    const tree = buildMenuTree([dashboard, group])

    expect(tree[0]).toMatchObject({ id: 'workspace', type: 'group', path: null })
    expect(tree[0]?.children?.[0]).toMatchObject({ id: 'dashboard', path: '/dashboard' })
  })
})
