import type { RouteRecordRaw } from 'vue-router'
import { expect, test, vi } from 'vite-plus/test'
import { createMemoryHistory, createRouter } from 'vue-router'
import { normalizeAdminPath, registerAdminAccessRoutes, resetAdminAccessRoutes, resolveAdminAccess, splitAdminFileRoutes } from './access'

vi.mock('virtual:generated-layouts', () => ({
  setupLayouts: (routes: RouteRecordRaw[]) => routes,
}))

const component = { template: '<div />' }

test('keeps core and fallback routes out of access candidates', () => {
  const result = splitAdminFileRoutes([
    { component, path: '/auth/login' },
    { component, path: '/403' },
    {
      component,
      path: '/dashboard',
      children: [{ component, path: 'workbench' }],
    },
  ])

  expect(result.coreRoutes.map((route) => route.path)).toEqual(['/auth/login'])
  expect(result.fallbackRoutes.map((route) => route.path)).toEqual(['/403'])
  expect(result.accessFileRoutes.map((route) => route.path)).toEqual(['/dashboard', '/dashboard/workbench'])
  expect(result.accessFileRoutes.every((route) => !route.children?.length)).toBe(true)
})

const accessFileRoutes: RouteRecordRaw[] = [
  { component, path: '/dashboard', meta: { menuGroup: { label: '旧分组', order: 1 }, title: 'Old dashboard' } },
  { component, path: '/dashboard/workbench', meta: { menuGroup: { label: '旧分组', order: 1 }, title: 'Old title' } },
  { component, path: '/access' },
  { component, path: '/access/menu-visible-403' },
  { component, path: '/system/role' },
  { component, path: '/system/settings/theme' },
]

const backendMenus = [
  {
    id: 'dashboard',
    path: '/dashboard',
    meta: { icon: 'i-lucide-layout-dashboard', menuGroup: { label: '工作台', order: 10 }, order: 10, title: 'Dashboard' },
    children: [
      {
        id: 'dashboard-workbench',
        path: '/dashboard/workbench',
        meta: { icon: 'i-lucide-monitor', order: 10, title: '工作台' },
      },
    ],
  },
  {
    id: 'access',
    path: '/access',
    meta: { icon: 'i-lucide-key-round', menuGroup: { label: '工作台', order: 10 }, order: 30, title: '权限演示' },
    children: [
      {
        id: 'access-menu-visible-403',
        path: '/access/menu-visible-403',
        meta: { authority: ['admin'], icon: 'i-lucide-eye-off', menuVisibleWithForbidden: true, order: 10, title: '可见但无权限' },
      },
    ],
  },
  {
    id: 'system-role',
    path: '/system/role',
    meta: { authority: ['admin'], icon: 'i-lucide-shield', order: 20, title: '角色管理' },
  },
  {
    id: 'system-settings-theme',
    path: '/system/settings/theme',
    meta: { activePath: '/system/settings', authority: ['admin'], hideInMenu: true, hideInTab: true, title: '主题设置' },
  },
  {
    id: 'missing',
    path: '/missing',
    meta: { title: '不存在' },
  },
] satisfies Parameters<typeof resolveAdminAccess>[1]

test('merges backend meta into matching file routes and ignores missing paths', () => {
  const result = resolveAdminAccess(accessFileRoutes, backendMenus, ['admin'])

  expect(result.routePathSet.has('/dashboard/workbench')).toBe(true)
  expect(result.routePathSet.has('/missing')).toBe(false)
  expect(result.accessibleRoutes[0]?.meta?.title).toBe('Dashboard')
  expect(result.accessibleRoutes[0]?.meta?.menuGroup).toEqual({ label: '工作台', order: 10 })
  expect(result.accessibleRoutes[0]?.children?.[0]?.meta?.title).toBe('工作台')
  expect(result.accessibleRoutes[0]?.children?.[0]?.meta?.icon).toBe('i-lucide-monitor')
  expect(result.accessibleRoutes[0]?.children?.[0]?.meta?.menuGroup).toEqual({ label: '工作台', order: 10 })
})

test('filters routes by authority after merging backend menus', () => {
  const result = resolveAdminAccess(accessFileRoutes, backendMenus, ['user'])

  expect([...result.routePathSet]).toEqual(['/dashboard', '/dashboard/workbench', '/access', '/access/menu-visible-403'])
  expect(result.routePathSet.has('/system/role')).toBe(false)
  expect(result.menuGroups.flatMap((group) => group.children).map((item) => item.path)).toEqual(['/dashboard', '/access'])
})

test('keeps visible forbidden menus and replaces their page component with forbidden component', () => {
  const result = resolveAdminAccess(accessFileRoutes, backendMenus, ['user'])
  const accessRoute = result.accessibleRoutes.find((route) => route.path === '/access')
  const forbiddenRoute = accessRoute?.children?.find((route) => route.path === '/access/menu-visible-403')

  expect(result.routePathSet.has('/access/menu-visible-403')).toBe(true)
  expect(JSON.stringify(result.menuGroups)).toContain('/access/menu-visible-403')
  expect(forbiddenRoute?.component).not.toBe(component)
})

test('keeps real page component when visible forbidden route authority matches', () => {
  const result = resolveAdminAccess(accessFileRoutes, backendMenus, ['admin'])
  const accessRoute = result.accessibleRoutes.find((route) => route.path === '/access')
  const forbiddenRoute = accessRoute?.children?.find((route) => route.path === '/access/menu-visible-403')

  expect(forbiddenRoute?.component).toBe(component)
})

test('keeps hidden authorized child routes accessible without rendering them in the menu', () => {
  const result = resolveAdminAccess(accessFileRoutes, backendMenus, ['admin'])

  expect(result.routePathSet.has('/system/settings/theme')).toBe(true)
  expect(JSON.stringify(result.menuGroups)).not.toContain('/system/settings/theme')
})

test('adds and removes dynamic routes', () => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ component, path: '/auth/login' }],
  })

  registerAdminAccessRoutes(router, [{ component, path: '/dashboard/workbench' }])

  expect(router.hasRoute('/dashboard/workbench')).toBe(false)
  expect(router.resolve('/dashboard/workbench').matched.some((route) => normalizeAdminPath(route.path) === '/dashboard/workbench')).toBe(true)

  resetAdminAccessRoutes()

  expect(router.resolve('/dashboard/workbench').matched.some((route) => normalizeAdminPath(route.path) === '/dashboard/workbench')).toBe(false)
})
