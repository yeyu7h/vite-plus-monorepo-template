import type { RouteRecordRaw } from 'vue-router'
import { expect, test } from 'vite-plus/test'
import { mergeBackendMenusWithFileRoutes } from './merge'
import { createAdminNavigationRoutes } from './navigation'
import { filterRoutesByAuthority } from './permission'
import { splitAdminFileRoutes } from './source'

const component = { template: '<div />' }
const forbiddenComponent = { template: '<div>403</div>' }

test('splits file routes into source buckets before access resolution', () => {
  const result = splitAdminFileRoutes([
    { component, path: '/auth/login' },
    { component, path: '/404' },
    {
      component,
      path: '/dashboard',
      children: [{ component, path: 'workbench' }],
    },
  ])

  expect(result.coreRoutes.map((route) => route.path)).toEqual(['/auth/login'])
  expect(result.fallbackRoutes.map((route) => route.path)).toEqual(['/404'])
  expect(result.accessFileRoutes.map((route) => route.path)).toEqual(['/dashboard', '/dashboard/workbench'])
})

test('merges backend menu meta onto matching file routes only', () => {
  const routes: RouteRecordRaw[] = [
    { component, path: '/dashboard', meta: { title: 'Old dashboard' } },
    { component, path: '/dashboard/workbench', meta: { title: 'Old workbench' } },
  ]
  const menus: Parameters<typeof mergeBackendMenusWithFileRoutes>[0] = [
    {
      id: 'dashboard',
      path: '/dashboard',
      meta: { menuGroup: { label: '工作台', order: 10 }, title: 'Dashboard' },
      children: [
        {
          id: 'dashboard-workbench',
          path: '/dashboard/workbench',
          meta: { icon: 'i-lucide-monitor', title: '工作台' },
        },
        {
          id: 'missing',
          path: '/missing',
          meta: { title: '不存在' },
        },
      ],
    },
  ]

  const mergedRoutes = mergeBackendMenusWithFileRoutes(menus, routes)

  expect(mergedRoutes).toHaveLength(1)
  expect(mergedRoutes[0]?.meta?.title).toBe('Dashboard')
  expect(mergedRoutes[0]?.children?.map((route) => route.path)).toEqual(['/dashboard/workbench'])
  expect(mergedRoutes[0]?.children?.[0]?.meta?.menuGroup).toEqual({ label: '工作台', order: 10 })
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
      matched: void 0,
      meta: { source: 'access', title: 'Dashboard' },
      parentPath: void 0,
      path: '/dashboard',
      source: 'access',
      tabPath: '/dashboard',
    },
    {
      activePath: '/dashboard/workbench',
      matched: void 0,
      meta: { source: 'access', title: '工作台' },
      parentPath: '/dashboard',
      path: '/dashboard/workbench',
      source: 'access',
      tabPath: '/dashboard/workbench',
    },
  ])
})

test('derives canonical active and tab paths from activePath and hideInTab meta', () => {
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
            hideInTab: true,
            title: '主题设置',
          },
        },
      ],
    },
  ])

  expect(navigationRoutes).toEqual([
    {
      activePath: '/system',
      matched: void 0,
      meta: { menuGroup: { label: '系统管理', order: 30 }, title: '系统' },
      parentPath: void 0,
      path: '/system',
      source: void 0,
      tabPath: '/system',
    },
    {
      activePath: '/system/settings',
      matched: void 0,
      meta: {
        activePath: '/system/settings',
        hideInMenu: true,
        hideInTab: true,
        title: '主题设置',
      },
      parentPath: '/system/settings',
      path: '/system/settings/theme',
      source: void 0,
      tabPath: '/system/settings',
    },
  ])
})
