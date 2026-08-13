import type { AdminMenuGroup, AdminNavigationRouteRecord } from '@monorepo-admin-core/types'
import type { RouteRecordRaw } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, expect, test, vi } from 'vite-plus/test'
import { useAdminAccessStore } from './access'

const mocks = vi.hoisted(() => ({
  createAdminRoutePathMatcher: vi.fn<(routes: readonly RouteRecordRaw[]) => (path: string) => boolean>(),
  registerAdminAccessRoutes: vi.fn<(router: unknown, routes: readonly RouteRecordRaw[]) => void>(),
  resetAdminAccessRoutes: vi.fn<() => void>(),
  resolveAdminAccess: vi.fn<
    () => {
      accessibleRoutes: RouteRecordRaw[]
      menuGroups: AdminMenuGroup[]
      navigationRoutes: AdminNavigationRouteRecord[]
      routePathSet: Set<string>
    }
  >(),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({}),
}))

vi.mock('@/router', () => ({
  accessFileRoutes: [],
}))

vi.mock('@/router/access', () => ({
  DEFAULT_ADMIN_HOME_PATH: '/dashboard/workbench',
  FORBIDDEN_ROUTE_PATH: '/403',
  createAdminRoutePathMatcher: mocks.createAdminRoutePathMatcher,
  normalizeAdminPath: (path: string) => path,
  registerAdminAccessRoutes: mocks.registerAdminAccessRoutes,
  resetAdminAccessRoutes: mocks.resetAdminAccessRoutes,
  resolveAdminAccess: mocks.resolveAdminAccess,
}))

const storage = new Map<string, string>()

beforeEach(() => {
  vi.clearAllMocks()
  storage.clear()
  setActivePinia(createPinia())

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      removeItem: (key: string) => storage.delete(key),
      setItem: (key: string, value: string) => storage.set(key, value),
    },
  })

  mocks.createAdminRoutePathMatcher.mockReturnValue(() => false)
  mocks.resolveAdminAccess.mockReturnValue({
    accessibleRoutes: [],
    menuGroups: [],
    navigationRoutes: [],
    routePathSet: new Set(),
  })
})

test('persists the access token and treats an empty access result as initialized', () => {
  const store = useAdminAccessStore()

  store.setAccessToken('access-token:empty')
  store.initializeAccess([], [])

  expect(store.accessToken).toBe('access-token:empty')
  expect(store.isLoggedIn).toBe(true)
  expect(store.isAccessInitialized).toBe(true)
  expect(storage.get('template-admin:access-token')).toBe('access-token:empty')
  expect(mocks.resolveAdminAccess).toHaveBeenCalledExactlyOnceWith([], [], [])
  expect(mocks.registerAdminAccessRoutes).toHaveBeenCalledWith(expect.anything(), [])
})

test('resolves accessible and fallback paths from initialized routes', () => {
  const accessibleRoutes: RouteRecordRaw[] = [{ component: {}, path: '/dashboard/workbench' }]
  mocks.createAdminRoutePathMatcher.mockReturnValue((path) => path === '/dashboard/workbench')
  mocks.resolveAdminAccess.mockReturnValue({
    accessibleRoutes,
    menuGroups: [],
    navigationRoutes: [],
    routePathSet: new Set(['/dashboard/workbench']),
  })

  const store = useAdminAccessStore()
  store.initializeAccess([], ['admin'])

  expect(store.canAccessPath('/dashboard/workbench')).toBe(true)
  expect(store.canAccessPath('/system/role')).toBe(false)
  expect(store.resolveHomePath('/system/role')).toBe('/dashboard/workbench')
  expect(store.resolveAccessiblePath('/system/role')).toBe('/dashboard/workbench')
})

test('resolves fallback paths using the displayed menu group order', () => {
  mocks.resolveAdminAccess.mockReturnValue({
    accessibleRoutes: [],
    menuGroups: [
      {
        id: 'group:system',
        label: '系统管理',
        order: 30,
        children: [{ id: '/system', path: '/system', title: '系统', children: [{ id: '/system/role', path: '/system/role', title: '角色管理' }] }],
      },
      { id: 'default', children: [{ id: '/access', path: '/access', order: 1, title: '权限演示' }] },
    ],
    navigationRoutes: [],
    routePathSet: new Set(['/access', '/system', '/system/role']),
  })

  const store = useAdminAccessStore()
  store.initializeAccess([], ['admin'])

  expect(store.resolveHomePath('/dashboard/workbench')).toBe('/system/role')
  expect(store.resolveAccessiblePath('/dashboard/workbench')).toBe('/system/role')
})

test('stores backend permission codes and exposes permission checks', () => {
  const store = useAdminAccessStore()
  const accessPayload = {
    menus: [],
    permissionCodes: ['system:role:create'],
  }

  store.initializeAccess(accessPayload, ['admin'])

  expect(store.permissionCodes).toEqual(['system:role:create'])
  expect(store.hasPermission('system:role:create')).toBe(true)
  expect(store.hasPermission('system:role:delete')).toBe(false)
  expect(mocks.resolveAdminAccess).toHaveBeenCalledExactlyOnceWith([], [], ['admin'])

  store.resetAccess()

  expect(store.permissionCodes).toEqual([])
  expect(store.hasPermission('system:role:create')).toBe(false)
})

test('supports segmented permission wildcards', () => {
  const store = useAdminAccessStore()

  store.initializeAccess({ menus: [], permissionCodes: ['*:*:*'] }, ['admin'])

  expect(store.hasPermission('system:role:create')).toBe(true)
  expect(store.hasPermission('system:user:delete')).toBe(true)
  expect(store.hasPermission('system:role')).toBe(false)

  store.initializeAccess({ menus: [], permissionCodes: ['system:role:*'] }, ['operator'])

  expect(store.hasPermission('system:role:create')).toBe(true)
  expect(store.hasPermission('system:user:create')).toBe(false)
})

test('resets generated access when the token changes', () => {
  storage.set('template-admin:access-token', 'access-token:old')
  const store = useAdminAccessStore()
  store.initializeAccess([], [])

  store.setAccessToken('access-token:new')

  expect(store.isAccessInitialized).toBe(false)
  expect(store.menuGroups).toEqual([])
  expect(store.navigationRoutes).toEqual([])
  expect(storage.get('template-admin:access-token')).toBe('access-token:new')
  expect(mocks.resetAdminAccessRoutes).toHaveBeenCalledOnce()
})

test('clears the token and generated access on reset', () => {
  storage.set('template-admin:access-token', 'access-token:active')
  const store = useAdminAccessStore()
  store.initializeAccess([], [])

  store.resetAccess()

  expect(store.accessToken).toBeNull()
  expect(store.isLoggedIn).toBe(false)
  expect(store.isAccessInitialized).toBe(false)
  expect(storage.has('template-admin:access-token')).toBe(false)
  expect(mocks.resetAdminAccessRoutes).toHaveBeenCalledOnce()
})

test('invalidates the session without removing the current dynamic routes', () => {
  storage.set('template-admin:access-token', 'access-token:active')
  const store = useAdminAccessStore()
  store.initializeAccess([], [])
  const sessionVersion = store.sessionVersion

  store.invalidateSession()

  expect(store.accessToken).toBeNull()
  expect(store.isLoggedIn).toBe(false)
  expect(store.sessionVersion).toBe(sessionVersion + 1)
  expect(store.isAccessInitialized).toBe(true)
  expect(storage.has('template-admin:access-token')).toBe(false)
  expect(mocks.resetAdminAccessRoutes).not.toHaveBeenCalled()

  store.resetAccessState()

  expect(store.isAccessInitialized).toBe(false)
  expect(mocks.resetAdminAccessRoutes).toHaveBeenCalledOnce()
})
