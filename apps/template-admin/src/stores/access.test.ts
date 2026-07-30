import type { AdminBackendMenu, AdminMenuGroup, AdminNavigationRouteRecord } from '@monorepo-admin-core/types'
import type { RouteRecordRaw } from 'vue-router'
import type { CoreAuthApi } from '@/api/core/auth'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, expect, test, vi } from 'vite-plus/test'
import { useAdminAccessStore } from './access'

const mocks = vi.hoisted(() => ({
  getIdentity: vi.fn<() => Promise<CoreAuthApi.IdentityResult>>(),
  getBackendMenusApi: vi.fn<() => Promise<AdminBackendMenu[]>>(),
  login: vi.fn<(params: CoreAuthApi.LoginBody) => Promise<CoreAuthApi.LoginResult>>(),
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
}))

vi.mock('@/api/core/auth', () => ({
  coreAuthApi: {
    getIdentity: mocks.getIdentity,
    login: mocks.login,
  },
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
const identity: CoreAuthApi.IdentityResult = {
  avatar: null,
  id: 'empty',
  nickName: 'No Menu User',
  roles: [],
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

  mocks.login.mockResolvedValue({ accessToken: 'access-token:empty' })
  mocks.getIdentity.mockResolvedValue(identity)
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
  expect(mocks.login).toHaveBeenCalledExactlyOnceWith({ captchaToken: 'captcha-token', password: 'password', username: 'empty' })
  expect(storage.get('template-admin:access-token')).toBe('access-token:empty')
  expect(mocks.getIdentity).toHaveBeenCalledOnce()
  expect(mocks.getBackendMenusApi).toHaveBeenCalledOnce()
  expect(mocks.registerAdminAccessRoutes).toHaveBeenCalledWith(expect.anything(), [])

  await expect(store.restoreAccess()).resolves.toBe(false)
  expect(mocks.getIdentity).toHaveBeenCalledOnce()
  expect(mocks.getBackendMenusApi).toHaveBeenCalledOnce()
})

test('reuses an in-flight access setup across concurrent restores', async () => {
  storage.set('template-admin:access-token', 'mock-token:empty')

  let resolveIdentity: ((value: typeof identity) => void) | undefined
  mocks.getIdentity.mockReturnValue(
    new Promise((resolve) => {
      resolveIdentity = resolve
    }),
  )

  const store = useAdminAccessStore()
  const firstRestore = store.restoreAccess()
  const secondRestore = store.restoreAccess()

  expect(mocks.getIdentity).toHaveBeenCalledOnce()
  expect(mocks.getBackendMenusApi).toHaveBeenCalledOnce()

  resolveIdentity?.(identity)

  await expect(Promise.all([firstRestore, secondRestore])).resolves.toEqual([true, true])
  expect(store.isAccessInitialized).toBe(true)
  expect(mocks.registerAdminAccessRoutes).toHaveBeenCalledOnce()
})

test('clears persisted application tabs when restoring an invalid login before layout initialization', async () => {
  storage.set('template-admin:access-token', 'mock-token:invalid')
  sessionStorageValues.set('template-admin:open-tabs', '{"version":1,"tabs":[{"to":"/dashboard","viewPath":"/dashboard"}]}')
  mocks.getIdentity.mockRejectedValue(new Error('invalid token'))

  const store = useAdminAccessStore()

  await expect(store.restoreAccess()).rejects.toThrow('登录状态无效')
  expect(sessionStorageValues.has('template-admin:open-tabs')).toBe(false)
})

test('clears the new token when access initialization fails after login', async () => {
  mocks.getIdentity.mockRejectedValue(new Error('invalid token'))
  const store = useAdminAccessStore()

  await expect(store.login({ captchaToken: 'captcha-token', password: 'password', username: 'empty' })).rejects.toThrow('invalid token')

  expect(store.isLoggedIn).toBe(false)
  expect(storage.has('template-admin:access-token')).toBe(false)
})
