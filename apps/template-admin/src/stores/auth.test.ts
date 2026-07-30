import type { AdminBackendMenu } from '@monorepo-admin-core/types'
import type { CoreAuthApi } from '@/api/core/auth'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, expect, test, vi } from 'vite-plus/test'
import { useAdminAuthStore } from './auth'
import { useAdminUserStore } from './user'

const mocks = vi.hoisted(() => {
  const accessStore = {
    accessToken: null as null | string,
    canAccessPath: vi.fn<(path: string) => boolean>(),
    initializeAccess: vi.fn<(backendMenus: readonly AdminBackendMenu[], roles: readonly string[]) => void>(),
    isAccessInitialized: false,
    isLoggedIn: false,
    resetAccess: vi.fn<() => void>(),
    resolveHomePath: vi.fn<(path: string) => string>(),
    setAccessToken: vi.fn<(token: null | string) => void>(),
  }

  return {
    accessStore,
    getBackendMenusApi: vi.fn<() => Promise<AdminBackendMenu[]>>(),
    getIdentity: vi.fn<() => Promise<CoreAuthApi.IdentityResult>>(),
    login: vi.fn<(params: CoreAuthApi.LoginBody) => Promise<CoreAuthApi.LoginResult>>(),
    routerReplace: vi.fn<(path: string) => Promise<void>>(),
    tabReset: vi.fn<(options: { storageKey: string }) => void>(),
  }
})

vi.mock('vue-router', () => ({
  useRouter: () => ({
    replace: mocks.routerReplace,
  }),
}))

vi.mock('@monorepo-admin-core/layout-effect', () => ({
  useAdminTabStore: () => ({
    reset: mocks.tabReset,
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

vi.mock('@/router/access', () => ({
  DEFAULT_ADMIN_HOME_PATH: '/dashboard/workbench',
  normalizeAdminPath: (path: string) => path,
}))

vi.mock('./access', () => ({
  useAdminAccessStore: () => mocks.accessStore,
}))

const identity: CoreAuthApi.IdentityResult = {
  avatar: null,
  id: 'empty',
  nickName: 'No Menu User',
  roles: [],
  username: 'empty',
}

beforeEach(() => {
  vi.clearAllMocks()
  setActivePinia(createPinia())

  mocks.accessStore.accessToken = null
  mocks.accessStore.isAccessInitialized = false
  mocks.accessStore.isLoggedIn = false
  mocks.accessStore.canAccessPath.mockReturnValue(false)
  mocks.accessStore.resolveHomePath.mockImplementation((path) => path)
  mocks.accessStore.setAccessToken.mockImplementation((token) => {
    mocks.accessStore.accessToken = token
    mocks.accessStore.isLoggedIn = Boolean(token)
    mocks.accessStore.isAccessInitialized = false
  })
  mocks.accessStore.initializeAccess.mockImplementation(() => {
    mocks.accessStore.isAccessInitialized = true
  })
  mocks.accessStore.resetAccess.mockImplementation(() => {
    mocks.accessStore.accessToken = null
    mocks.accessStore.isLoggedIn = false
    mocks.accessStore.isAccessInitialized = false
  })

  mocks.login.mockResolvedValue({ accessToken: 'access-token:empty' })
  mocks.getIdentity.mockResolvedValue(identity)
  mocks.getBackendMenusApi.mockResolvedValue([])
  mocks.routerReplace.mockResolvedValue()
})

test('logs in, initializes access, and runs the success callback', async () => {
  const store = useAdminAuthStore()
  const onSuccess = vi.fn<() => Promise<void>>().mockResolvedValue()

  await expect(store.authLogin({ captchaToken: 'captcha-token', password: 'password', username: 'empty' }, onSuccess)).resolves.toEqual({
    userInfo: {
      avatar: undefined,
      home_path: '/dashboard/workbench',
      real_name: 'No Menu User',
      roles: [],
      user_id: 'empty',
      username: 'empty',
    },
  })

  expect(store.loginLoading).toBe(false)
  expect(mocks.login).toHaveBeenCalledExactlyOnceWith({ captchaToken: 'captcha-token', password: 'password', username: 'empty' })
  expect(mocks.accessStore.setAccessToken).toHaveBeenCalledExactlyOnceWith('access-token:empty')
  expect(mocks.getIdentity).toHaveBeenCalledOnce()
  expect(mocks.getBackendMenusApi).toHaveBeenCalledOnce()
  expect(mocks.accessStore.initializeAccess).toHaveBeenCalledExactlyOnceWith([], [])
  expect(onSuccess).toHaveBeenCalledOnce()
})

test('clears the new session when access initialization fails after login', async () => {
  mocks.getIdentity.mockRejectedValue(new Error('invalid token'))
  const store = useAdminAuthStore()

  await expect(store.authLogin({ captchaToken: 'captcha-token', password: 'password', username: 'empty' })).rejects.toThrow('invalid token')

  expect(store.loginLoading).toBe(false)
  expect(mocks.accessStore.resetAccess).toHaveBeenCalledOnce()
  expect(mocks.tabReset).toHaveBeenCalledExactlyOnceWith({ storageKey: 'template-admin:open-tabs' })
  expect(useAdminUserStore().userInfo).toBeNull()
})

test('reuses an in-flight access setup across concurrent restores', async () => {
  mocks.accessStore.accessToken = 'access-token:empty'

  let resolveIdentity: ((value: typeof identity) => void) | undefined
  mocks.getIdentity.mockReturnValue(
    new Promise((resolve) => {
      resolveIdentity = resolve
    }),
  )

  const store = useAdminAuthStore()
  const firstRestore = store.restoreAccess()
  const secondRestore = store.restoreAccess()

  expect(mocks.getIdentity).toHaveBeenCalledOnce()
  expect(mocks.getBackendMenusApi).toHaveBeenCalledOnce()

  resolveIdentity?.(identity)

  await expect(Promise.all([firstRestore, secondRestore])).resolves.toEqual([true, true])
  expect(mocks.accessStore.initializeAccess).toHaveBeenCalledOnce()
})

test('clears application state when restoring an invalid session', async () => {
  mocks.accessStore.accessToken = 'access-token:invalid'
  mocks.getIdentity.mockRejectedValue(new Error('invalid token'))
  const store = useAdminAuthStore()

  await expect(store.restoreAccess()).rejects.toThrow('登录状态无效')

  expect(mocks.accessStore.resetAccess).toHaveBeenCalledOnce()
  expect(mocks.tabReset).toHaveBeenCalledExactlyOnceWith({ storageKey: 'template-admin:open-tabs' })
})

test('does not apply an access result from a stale session', async () => {
  mocks.accessStore.accessToken = 'access-token:old'

  let resolveIdentity: ((value: typeof identity) => void) | undefined
  mocks.getIdentity.mockReturnValue(
    new Promise((resolve) => {
      resolveIdentity = resolve
    }),
  )

  const store = useAdminAuthStore()
  const restore = store.restoreAccess()
  mocks.accessStore.accessToken = 'access-token:new'
  resolveIdentity?.(identity)

  await expect(restore).resolves.toBe(false)
  expect(mocks.accessStore.initializeAccess).not.toHaveBeenCalled()
  expect(useAdminUserStore().userInfo).toBeNull()
})

test('starts a fresh access setup when logging in during an older session restore', async () => {
  mocks.accessStore.accessToken = 'access-token:old'

  let resolveOldIdentity: ((value: typeof identity) => void) | undefined
  mocks.getIdentity
    .mockReturnValueOnce(
      new Promise((resolve) => {
        resolveOldIdentity = resolve
      }),
    )
    .mockResolvedValueOnce(identity)

  const store = useAdminAuthStore()
  const oldRestore = store.restoreAccess()
  const newLogin = store.authLogin({ captchaToken: 'captcha-token', password: 'password', username: 'empty' })

  await expect(newLogin).resolves.toMatchObject({
    userInfo: {
      username: 'empty',
    },
  })

  resolveOldIdentity?.(identity)

  await expect(oldRestore).resolves.toBe(false)
  expect(mocks.getIdentity).toHaveBeenCalledTimes(2)
  expect(mocks.accessStore.initializeAccess).toHaveBeenCalledOnce()
})

test('fetches and stores user information', async () => {
  const store = useAdminAuthStore()

  await expect(store.fetchUserInfo()).resolves.toMatchObject({
    real_name: 'No Menu User',
    user_id: 'empty',
  })
  expect(useAdminUserStore().userInfo).toMatchObject({
    real_name: 'No Menu User',
    user_id: 'empty',
  })
})

test('logs out by resetting session state and redirecting to login', async () => {
  mocks.accessStore.accessToken = 'access-token:active'
  const userStore = useAdminUserStore()
  userStore.setUserInfo({
    home_path: '/dashboard/workbench',
    real_name: 'Admin',
    roles: ['admin'],
    user_id: 'admin',
    username: 'admin',
  })
  const store = useAdminAuthStore()

  await store.logout()

  expect(mocks.accessStore.resetAccess).toHaveBeenCalledOnce()
  expect(mocks.tabReset).toHaveBeenCalledExactlyOnceWith({ storageKey: 'template-admin:open-tabs' })
  expect(userStore.userInfo).toBeNull()
  expect(mocks.routerReplace).toHaveBeenCalledExactlyOnceWith('/auth/login')
})
