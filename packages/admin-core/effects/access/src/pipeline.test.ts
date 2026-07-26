import type { RouteRecordRaw } from 'vue-router'
import { expect, test } from 'vite-plus/test'
import { mergeBackendMenusWithFileRoutes } from './merge'
import { createAdminNavigationRoutes } from './navigation'
import { collectRawRoutePaths, createAdminRoutePathMatcher, filterRawRouteRecords } from './path'
import { filterRoutesByAuthority } from './permission'
import { resolveAdminAccess } from './resolve'

const component = { template: '<div />' }
const forbiddenComponent = { template: '<div>403</div>' }

test('merges backend menu meta onto matching file routes only', () => {
  const routes: RouteRecordRaw[] = [
    {
      component,
      path: '/dashboard',
      meta: { title: 'Old dashboard' },
      children: [{ component, path: 'workbench', meta: { title: 'Old workbench' } }],
    },
  ]
  const menus: Parameters<typeof mergeBackendMenusWithFileRoutes>[0] = [
    {
      id: 'dashboard',
      path: '/dashboard',
      meta: { menuGroup: { label: '工作台', order: 10 }, title: 'Dashboard' },
      children: [
        {
          id: 'dashboard-workbench',
          path: 'workbench',
          meta: { icon: 'i-lucide-monitor', title: '工作台' },
        },
        {
          id: 'missing',
          path: 'missing',
          meta: { title: '不存在' },
        },
      ],
    },
  ]

  const mergedRoutes = mergeBackendMenusWithFileRoutes(menus, routes)

  expect(mergedRoutes).toHaveLength(1)
  expect(mergedRoutes[0]?.meta?.title).toBe('Dashboard')
  expect(mergedRoutes[0]?.children?.map((route) => route.path)).toEqual(['workbench'])
  expect(mergedRoutes[0]?.children?.[0]?.meta?.menuGroup).toEqual({ label: '工作台', order: 10 })
})

test('promotes a deeply nested file page to an absolute top-level backend route', () => {
  const routes: RouteRecordRaw[] = [
    {
      path: '/docs',
      children: [{ component, path: 'vite-plus' }],
    },
  ]

  const mergedRoutes = mergeBackendMenusWithFileRoutes([{ id: 'docs-vite-plus', path: '/docs/vite-plus', meta: { title: 'Vite+ Docs' } }], routes)

  expect(mergedRoutes[0]?.path).toBe('/docs/vite-plus')
  expect(mergedRoutes[0]?.component).toBe(component)
})

test('filters route trees without flattening and collects canonical paths', () => {
  const routes: RouteRecordRaw[] = [
    {
      path: '/auth',
      children: [
        { component, path: 'login', meta: { initial: true } },
        { component, path: 'register' },
      ],
    },
  ]

  const initialRoutes = filterRawRouteRecords(routes, (route) => route.meta?.initial === true)

  expect(initialRoutes).toHaveLength(1)
  expect(initialRoutes[0]?.path).toBe('/auth')
  expect(initialRoutes[0]?.children?.map((route) => route.path)).toEqual(['login'])
  expect(collectRawRoutePaths(initialRoutes)).toEqual(['/auth', '/auth/login'])
})

test('matches dynamic access paths and aliases with the Vue Router matcher', () => {
  const matchesAccessPath = createAdminRoutePathMatcher([
    {
      alias: '/members/:id',
      component,
      path: '/users/:id',
    },
  ])

  expect(matchesAccessPath('/users/42?tab=profile')).toBe(true)
  expect(matchesAccessPath('/members/42')).toBe(true)
  expect(matchesAccessPath('/users')).toBe(false)
  expect(matchesAccessPath('/unknown/42')).toBe(false)
})

test('filters unauthorized routes while keeping visible forbidden menu entries', () => {
  const routes: RouteRecordRaw[] = [
    { component, path: '/dashboard', meta: { title: 'Dashboard' } },
    { component, path: '/system/role', meta: { authority: ['admin'], title: '角色管理' } },
    { component, path: '/access/menu-visible-403', meta: { authority: ['admin'], menuVisibleWithForbidden: true, title: '可见但无权限' } },
  ]

  const filteredRoutes = filterRoutesByAuthority(routes, ['user'], forbiddenComponent)

  expect(filteredRoutes.map((route) => route.path)).toEqual(['/dashboard', '/access/menu-visible-403'])
  expect(filteredRoutes[1]?.component).toBe(forbiddenComponent)
})

test('creates default canonical navigation fields from route paths and sources', () => {
  const navigationRoutes = createAdminNavigationRoutes([
    {
      component,
      path: '/dashboard',
      meta: { source: 'access', title: 'Dashboard' },
      children: [
        {
          component,
          path: 'workbench',
          meta: { source: 'access', title: '工作台' },
        },
      ],
    },
  ])

  expect(navigationRoutes).toEqual([
    {
      activePath: '/dashboard',
      meta: { source: 'access', title: 'Dashboard' },
      parentPath: void 0,
      path: '/dashboard',
      source: 'access',
      tabPath: '/dashboard',
    },
    {
      activePath: '/dashboard/workbench',
      meta: { source: 'access', title: '工作台' },
      parentPath: '/dashboard',
      path: '/dashboard/workbench',
      source: 'access',
      tabPath: '/dashboard/workbench',
    },
  ])
})

test('derives canonical active and tab paths independently from route meta', () => {
  const navigationRoutes = createAdminNavigationRoutes([
    {
      component,
      path: '/system',
      meta: { menuGroup: { label: '系统管理', order: 30 }, title: '系统' },
      children: [
        {
          component,
          path: 'settings/theme',
          meta: {
            activePath: '/system/settings',
            hideInMenu: true,
            tabPath: '/system/settings',
            title: '主题设置',
          },
        },
      ],
    },
  ])

  expect(navigationRoutes).toEqual([
    {
      activePath: '/system',
      meta: { menuGroup: { label: '系统管理', order: 30 }, title: '系统' },
      parentPath: void 0,
      path: '/system',
      source: void 0,
      tabPath: '/system',
    },
    {
      activePath: '/system/settings',
      meta: {
        activePath: '/system/settings',
        hideInMenu: true,
        tabPath: '/system/settings',
        title: '主题设置',
      },
      parentPath: '/system/settings',
      path: '/system/settings/theme',
      source: void 0,
      tabPath: '/system/settings',
    },
  ])
})

test('resolves accessible routes menus and route paths with injected forbidden component', () => {
  const result = resolveAdminAccess(
    [
      { component, path: '/dashboard', meta: { title: 'Dashboard' } },
      { component, path: '/access', children: [{ component, path: 'menu-visible-403' }] },
      { component, path: '/system', children: [{ component, path: 'role' }] },
    ],
    [
      {
        id: 'dashboard',
        path: '/dashboard',
        meta: { menuGroup: { label: '工作台', order: 10 }, title: 'Dashboard' },
      },
      {
        id: 'access',
        path: '/access',
        meta: { menuGroup: { label: '工作台', order: 10 }, title: '权限演示' },
        children: [
          {
            id: 'access-menu-visible-403',
            path: 'menu-visible-403',
            meta: { authority: ['admin'], menuVisibleWithForbidden: true, title: '可见但无权限' },
          },
        ],
      },
      {
        id: 'system',
        path: '/system',
        meta: { authority: ['admin'], title: '系统' },
        children: [
          {
            id: 'system-role',
            path: 'role',
            meta: { authority: ['admin'], title: '角色管理' },
          },
        ],
      },
    ],
    ['user'],
    { forbiddenComponent },
  )

  const accessRoute = result.accessibleRoutes.find((route) => route.path === '/access')
  const forbiddenRoute = accessRoute?.children?.find((route) => route.path === 'menu-visible-403')

  expect([...result.routePathSet]).toEqual(['/dashboard', '/access', '/access/menu-visible-403'])
  expect(result.menuGroups.flatMap((group) => group.children).map((item) => item.path)).toEqual(['/dashboard', '/access'])
  expect(forbiddenRoute?.component).toBe(forbiddenComponent)
})
