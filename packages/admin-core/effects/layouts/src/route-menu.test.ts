import { afterEach, expect, test, vi } from 'vite-plus/test'
import { buildAdminMenuGroups, buildAdminMenus, markActiveAdminMenuGroups, markActiveAdminMenus } from './route-menu'

afterEach(() => {
  vi.restoreAllMocks()
})

test('builds sorted menu trees from visible route meta', () => {
  const menus = buildAdminMenus([
    { path: '/system', meta: { title: 'System', order: 10 } },
    { path: '/system/role', parentPath: '/system', meta: { title: '角色管理', icon: 'i-lucide-shield', order: 20 } },
    { path: '/dashboard', meta: { title: 'Dashboard', order: 10 } },
    { path: '/dashboard/workbench', parentPath: '/dashboard', meta: { title: '工作台', icon: 'i-lucide-layout-dashboard', order: 10 } },
    { path: '/system/user', parentPath: '/system', meta: { title: '用户管理', icon: 'i-lucide-users', order: 10 } },
    { path: '/hidden/audit', meta: { title: '审计日志', hideInMenu: true, order: 1 } },
  ])

  expect(menus).toEqual([
    {
      children: [
        {
          children: undefined,
          id: '/dashboard/workbench',
          order: 10,
          path: '/dashboard/workbench',
          title: '工作台',
          icon: 'i-lucide-layout-dashboard',
          activePath: undefined,
          authority: undefined,
          externalLink: undefined,
        },
      ],
      id: '/dashboard',
      order: 10,
      path: '/dashboard',
      title: 'Dashboard',
      activePath: undefined,
      authority: undefined,
      externalLink: undefined,
      icon: undefined,
    },
    {
      children: [
        {
          children: undefined,
          id: '/system/user',
          order: 10,
          path: '/system/user',
          title: '用户管理',
          icon: 'i-lucide-users',
          activePath: undefined,
          authority: undefined,
          externalLink: undefined,
        },
        {
          children: undefined,
          id: '/system/role',
          order: 20,
          path: '/system/role',
          title: '角色管理',
          icon: 'i-lucide-shield',
          activePath: undefined,
          authority: undefined,
          externalLink: undefined,
        },
      ],
      id: '/system',
      order: 10,
      path: '/system',
      title: 'System',
      activePath: undefined,
      authority: undefined,
      externalLink: undefined,
      icon: undefined,
    },
  ])
})

test('keeps a root external link with a multi-segment path at the root level', () => {
  const menus = buildAdminMenus([
    {
      path: '/external/docs',
      meta: {
        authority: ['admin'],
        externalLink: 'https://viteplus.dev/guide/',
        icon: 'i-lucide-book-open',
        title: 'Vite+ Docs',
      },
    },
  ])

  expect(menus).toHaveLength(1)
  expect(menus[0]).toMatchObject({
    authority: ['admin'],
    children: undefined,
    externalLink: 'https://viteplus.dev/guide/',
    id: '/external/docs',
    path: 'https://viteplus.dev/guide/',
    title: 'Vite+ Docs',
  })
})

test('marks current item and ancestors active', () => {
  const menus = markActiveAdminMenus(
    buildAdminMenus([
      { path: '/system', meta: { title: '系统' } },
      { path: '/system/user', parentPath: '/system', meta: { title: '用户管理', order: 10 } },
      { path: '/system/role', parentPath: '/system', meta: { title: '角色管理', order: 20 } },
    ]),
    '/system/role',
  )

  expect(menus[0]?.active).toBe(true)
  expect(menus[0]?.children?.[0]?.active).toBe(false)
  expect(menus[0]?.children?.[1]?.active).toBe(true)
})

test('builds third-level menu items without promotion', () => {
  const menus = buildAdminMenus([
    { path: '/one', meta: { title: 'One', icon: 'i-lucide-one' } },
    { path: '/one/two', parentPath: '/one', meta: { title: 'Two', icon: 'i-lucide-two' } },
    { path: '/one/two/three', parentPath: '/one/two', meta: { title: 'Three', icon: 'i-lucide-three' } },
  ])

  expect(menus[0]?.icon).toBe('i-lucide-one')
  expect(menus[0]?.children?.[0]?.icon).toBe('i-lucide-two')
  expect(menus[0]?.children?.[0]?.children?.[0]).toMatchObject({
    children: undefined,
    icon: undefined,
    id: '/one/two/three',
    path: '/one/two/three',
    title: 'Three',
  })
})

test('marks every ancestor of a third-level menu item active', () => {
  const menus = markActiveAdminMenus(
    buildAdminMenus([
      { path: '/one', meta: { title: 'One' } },
      { path: '/one/two', parentPath: '/one', meta: { title: 'Two' } },
      { path: '/one/two/three', parentPath: '/one/two', meta: { title: 'Three' } },
    ]),
    '/one/two/three',
  )

  expect(menus[0]?.active).toBe(true)
  expect(menus[0]?.children?.[0]?.active).toBe(true)
  expect(menus[0]?.children?.[0]?.children?.[0]?.active).toBe(true)
})

test('promotes visible deep routes to distinct third-level menu items and warns', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const menus = buildAdminMenus([
    { path: '/one', meta: { title: 'One' } },
    { path: '/one/two', parentPath: '/one', meta: { title: 'Two' } },
    { path: '/one/two/three', parentPath: '/one/two', meta: { title: 'Three' } },
    { path: '/one/two/three/four', parentPath: '/one/two/three', meta: { title: 'Four', order: 10 } },
    { path: '/one/two/three/five/six', parentPath: '/one/two/three', meta: { title: 'Six', order: 20 } },
    { path: '/one/two/three/hidden', parentPath: '/one/two/three', meta: { hideInMenu: true, title: 'Hidden' } },
  ])

  expect(menus[0]?.children?.[0]?.children).toMatchObject([
    {
      id: '/one/two/three',
      path: '/one/two/three',
      title: 'Three',
    },
    {
      children: undefined,
      id: '/one/two/three/four',
      path: '/one/two/three/four',
      title: 'Four',
    },
    {
      children: undefined,
      id: '/one/two/three/five/six',
      path: '/one/two/three/five/six',
      title: 'Six',
    },
  ])
  expect(warn).toHaveBeenCalledTimes(2)
  expect(warn).toHaveBeenNthCalledWith(1, expect.stringContaining('/one/two/three/four'))
  expect(warn).toHaveBeenNthCalledWith(2, expect.stringContaining('/one/two/three/five/six'))
})

test('clamps configured menu depth to three levels', () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  const menus = buildAdminMenus(
    [
      { path: '/one', meta: { title: 'One' } },
      { path: '/one/two', parentPath: '/one', meta: { title: 'Two' } },
      { path: '/one/two/three', parentPath: '/one/two', meta: { title: 'Three' } },
      { path: '/one/two/three/four', parentPath: '/one/two/three', meta: { title: 'Four' } },
    ],
    { maxDepth: 4 },
  )

  expect(menus[0]?.children?.[0]?.children?.find((item) => item.id === '/one/two/three/four')).toMatchObject({
    children: undefined,
    id: '/one/two/three/four',
    path: '/one/two/three/four',
    title: 'Four',
  })
})

test('builds sorted menu groups from route meta', () => {
  const groups = buildAdminMenuGroups([
    { path: '/system', meta: { title: 'System', group: { label: '系统管理', order: 20 } } },
    { path: '/system/role', parentPath: '/system', meta: { title: '角色管理', order: 20 } },
    { path: '/dashboard', meta: { title: 'Dashboard', group: { label: '概览', order: 10 } } },
    { path: '/dashboard/workbench', parentPath: '/dashboard', meta: { title: '工作台', order: 10 } },
    { path: '/system/settings', parentPath: '/system', meta: { title: '系统设置', order: 30 } },
    { path: '/docs/vite-plus', meta: { title: 'Vite+ Docs', group: { id: 'links', label: '链接', order: 30 } } },
    { path: '/hidden/audit', meta: { title: '审计日志', hideInMenu: true, group: '隐藏' } },
  ])

  expect(groups).toHaveLength(3)
  expect(groups.map((group) => group.label)).toEqual(['概览', '系统管理', '链接'])
  expect(groups[1]).toMatchObject({
    id: 'group:系统管理',
    label: '系统管理',
  })
  expect(groups[1]?.children[0]).toMatchObject({
    id: '/system',
    title: 'System',
    children: [
      { id: '/system/role', title: '角色管理' },
      { id: '/system/settings', title: '系统设置' },
    ],
  })
})

test('uses an unlabeled default group for routes without group', () => {
  const groups = buildAdminMenuGroups([
    { path: '/dashboard', meta: { title: 'Dashboard' } },
    { path: '/dashboard/workbench', parentPath: '/dashboard', meta: { title: '工作台' } },
  ])

  expect(groups).toEqual([
    {
      children: [
        {
          activePath: undefined,
          authority: undefined,
          children: [
            {
              activePath: undefined,
              authority: undefined,
              children: undefined,
              externalLink: undefined,
              icon: undefined,
              id: '/dashboard/workbench',
              order: 0,
              path: '/dashboard/workbench',
              title: '工作台',
            },
          ],
          externalLink: undefined,
          icon: undefined,
          id: '/dashboard',
          order: 0,
          path: '/dashboard',
          title: 'Dashboard',
        },
      ],
      id: 'default',
      label: undefined,
      order: undefined,
    },
  ])
})

test('places routes without group after all explicit menu groups', () => {
  const groups = buildAdminMenuGroups([
    { path: '/ungrouped', meta: { title: 'Ungrouped', order: 1 } },
    { path: '/last-group', meta: { title: 'Last group', group: { label: 'Last', order: 999 } } },
    { path: '/first-group', meta: { title: 'First group', group: { label: 'First', order: 10 } } },
  ])

  expect(groups.map((group) => group.id)).toEqual(['group:First', 'group:Last', 'default'])
})

test('inherits grouped menu children from nearest parent group', () => {
  const groups = buildAdminMenuGroups([
    { path: '/monitor', meta: { title: '监控', group: { label: '运维', order: 10 } } },
    { path: '/monitor/jobs', parentPath: '/monitor', meta: { title: '任务监控' } },
  ])

  expect(groups).toHaveLength(1)
  expect(groups[0]).toMatchObject({
    id: 'group:运维',
    label: '运维',
    order: 10,
    children: [
      {
        id: '/monitor',
        title: '监控',
        children: [{ id: '/monitor/jobs', title: '任务监控' }],
      },
    ],
  })
})

test('builds grouped routes to the third item level by default', () => {
  const groups = buildAdminMenuGroups([
    { path: '/one', meta: { title: 'One', group: 'Deep' } },
    { path: '/one/two', parentPath: '/one', meta: { title: 'Two' } },
    { path: '/one/two/three', parentPath: '/one/two', meta: { title: 'Three' } },
  ])

  expect(groups[0]?.children[0]?.children?.[0]?.children?.[0]).toMatchObject({
    children: undefined,
    id: '/one/two/three',
    path: '/one/two/three',
    title: 'Three',
  })
})

test('marks current grouped menu items active without mutating group state', () => {
  const groups = markActiveAdminMenuGroups(
    buildAdminMenuGroups([
      { path: '/system', meta: { title: '系统', group: '系统管理' } },
      { path: '/system/user', parentPath: '/system', meta: { title: '用户管理', order: 10 } },
      { path: '/system/role', parentPath: '/system', meta: { title: '角色管理', order: 20 } },
    ]),
    '/system/role',
  )

  expect('active' in groups[0]!).toBe(false)
  expect(groups[0]?.children[0]?.active).toBe(true)
  expect(groups[0]?.children[0]?.children?.[0]?.active).toBe(false)
  expect(groups[0]?.children[0]?.children?.[1]?.active).toBe(true)
})
