import type { AdminBackendMenu, AdminMenuGroup, AdminNavigationRouteRecord } from '@monorepo-admin-core/types'
import type { RouteRecordRaw } from 'vue-router'
import type { AdminLoginParams, AdminUserInfo } from '@/api/mock'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, expect, test, vi } from 'vite-plus/test'
import { useAdminAccessStore } from './access'

const mocks = vi.hoisted(() => ({
  getBackendMenusApi: vi.fn<() => Promise<AdminBackendMenu[]>>(),
  getUserInfoApi: vi.fn<(accessToken: string) => Promise<AdminUserInfo>>(),
  loginApi: vi.fn<(params: AdminLoginParams) => Promise<{ access_token: string }>>(),
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
  routerReplace: vi.fn<(path: string) => Promise<void>>(),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({
    replace: mocks.routerReplace,
  }),
}))

vi.mock('@/api/mock', () => ({
  getBackendMenusApi: mocks.getBackendMenusApi,
  getUserInfoApi: mocks.getUserInfoApi,
  loginApi: mocks.loginApi,
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
  setActivePinia(createPinia())

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      removeItem: (key: string) => storage.delete(key),
      setItem: (key: string, value: string) => storage.set(key, value),
    },
  })

  mocks.loginApi.mockResolvedValue({ access_token: 'mock-token:empty' })
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

  await store.login({ password: 'password', username: 'empty' })

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
