import type { AdminBackendMenu, AdminMenuGroup, AdminNavigationRouteRecord } from '@monorepo-admin-core/types'
import type { RouteRecordRaw } from 'vue-router'
import type { AdminLoginParams, AdminUserInfo } from '@/api/auth'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, expect, test, vi } from 'vite-plus/test'
import { useAdminAccessStore } from './access'

const mocks = vi.hoisted(() => ({
  getBackendMenusApi: vi.fn<() => Promise<AdminBackendMenu[]>>(),
  getUserInfoApi: vi.fn<(accessToken: string) => Promise<AdminUserInfo>>(),
  loginApi: vi.fn<(params: AdminLoginParams) => Promise<{ accessToken: string }>>(),
  logoutApi: vi.fn<() => Promise<void>>(),
  refreshTokenApi: vi.fn<() => Promise<{ accessToken: string }>>(),
  initializeAdminAuthentication: vi.fn<(options: { onSessionExpired: () => Promise<void> | void; refreshAccessToken: () => Promise<string> }) => void>(),
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
  routerReplace: vi.fn<(path: unknown) => Promise<void>>(),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({
    currentRoute: { value: { fullPath: '/dashboard/workbench' } },
    replace: mocks.routerReplace,
  }),
}))

vi.mock('@/api/auth', () => ({
  getUserInfoApi: mocks.getUserInfoApi,
  loginApi: mocks.loginApi,
  logoutApi: mocks.logoutApi,
  refreshTokenApi: mocks.refreshTokenApi,
}))

vi.mock('@/api/mock', () => ({
  getBackendMenusApi: mocks.getBackendMenusApi,
}))

vi.mock('@/api/request', () => ({
  initializeAdminAuthentication: mocks.initializeAdminAuthentication,
  markAdminSessionActive: vi.fn<() => void>(),
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
const sessionStorageValues = new Map<string, string>()
const userInfo: AdminUserInfo = {
  home_path: '/dashboard/workbench',
  real_name: 'No Menu User',
  roles: [],
  user_id: 'empty',
  username: 'empty',
}

beforeEach(() => {
  vi.clearAllMocks()
  storage.clear()
  sessionStorageValues.clear()
  setActivePinia(createPinia())

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      removeItem: (key: string) => storage.delete(key),
      setItem: (key: string, value: string) => storage.set(key, value),
    },
  })
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => sessionStorageValues.get(key) ?? null,
      removeItem: (key: string) => sessionStorageValues.delete(key),
      setItem: (key: string, value: string) => sessionStorageValues.set(key, value),
    },
  })

  mocks.loginApi.mockResolvedValue({ accessToken: 'mock-token:empty' })
  mocks.logoutApi.mockResolvedValue()
  mocks.refreshTokenApi.mockResolvedValue({ accessToken: 'mock-token:refreshed' })
  mocks.getUserInfoApi.mockResolvedValue(userInfo)
  mocks.getBackendMenusApi.mockResolvedValue([])
  mocks.createAdminRoutePathMatcher.mockReturnValue(() => false)
  mocks.resolveAdminAccess.mockReturnValue({
    accessibleRoutes: [],
    menuGroups: [],
    navigationRoutes: [],
    routePathSet: new Set(),
  })
})

test('treats an empty access result as initialized', async () => {
  const store = useAdminAccessStore()

  await store.login({ captchaToken: 'captcha-token', password: 'password', username: 'empty' })

  expect(store.isAccessInitialized).toBe(true)
  expect(mocks.getUserInfoApi).toHaveBeenCalledOnce()
  expect(mocks.getBackendMenusApi).toHaveBeenCalledOnce()
  expect(mocks.registerAdminAccessRoutes).toHaveBeenCalledWith(expect.anything(), [])

  await expect(store.restoreAccess()).resolves.toBe(false)
  expect(mocks.getUserInfoApi).toHaveBeenCalledOnce()
  expect(mocks.getBackendMenusApi).toHaveBeenCalledOnce()
})

test('reuses an in-flight access setup across concurrent restores', async () => {
  storage.set('template-admin:access-token', 'mock-token:empty')

  let resolveUserInfo: ((value: typeof userInfo) => void) | undefined
  mocks.getUserInfoApi.mockReturnValue(
    new Promise((resolve) => {
      resolveUserInfo = resolve
    }),
  )

  const store = useAdminAccessStore()
  const firstRestore = store.restoreAccess()
  const secondRestore = store.restoreAccess()

  expect(mocks.getUserInfoApi).toHaveBeenCalledOnce()
  expect(mocks.getBackendMenusApi).toHaveBeenCalledOnce()

  resolveUserInfo?.(userInfo)

  await expect(Promise.all([firstRestore, secondRestore])).resolves.toEqual([true, true])
  expect(store.isAccessInitialized).toBe(true)
  expect(mocks.registerAdminAccessRoutes).toHaveBeenCalledOnce()
})

test('keeps access setup results when the access token refreshes within the same session', async () => {
  storage.set('template-admin:access-token', 'expired-token')
  const store = useAdminAccessStore()
  const authentication = mocks.initializeAdminAuthentication.mock.calls[0]?.[0]
  expect(authentication).toBeDefined()

  mocks.getUserInfoApi.mockImplementation(async () => {
    await authentication?.refreshAccessToken()
    return userInfo
  })

  await expect(store.restoreAccess()).resolves.toBe(true)
  expect(storage.get('template-admin:access-token')).toBe('mock-token:refreshed')
  expect(store.isAccessInitialized).toBe(true)
  expect(mocks.registerAdminAccessRoutes).toHaveBeenCalledOnce()
})

test('clears persisted application tabs when restoring an invalid login before layout initialization', async () => {
  storage.set('template-admin:access-token', 'mock-token:invalid')
  sessionStorageValues.set('template-admin:open-tabs', '{"version":1,"tabs":[{"to":"/dashboard","viewPath":"/dashboard"}]}')
  mocks.getUserInfoApi.mockRejectedValue(new Error('invalid token'))

  const store = useAdminAccessStore()

  await expect(store.restoreAccess()).rejects.toThrow('登录状态无效')
  expect(sessionStorageValues.has('template-admin:open-tabs')).toBe(false)
})

test('cleans up the local session even when server logout fails', async () => {
  const store = useAdminAccessStore()
  await store.login({ captchaToken: 'captcha-token', password: 'password', username: 'empty' })
  mocks.logoutApi.mockRejectedValue(new Error('network error'))

  await expect(store.logout(false)).resolves.toBeUndefined()
  expect(storage.has('template-admin:access-token')).toBe(false)
  expect(sessionStorageValues.has('template-admin:open-tabs')).toBe(false)
  expect(mocks.resetAdminAccessRoutes).toHaveBeenCalled()
})
