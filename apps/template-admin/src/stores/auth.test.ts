import type { CoreAuthApi } from '@/api/core/auth'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, expect, test, vi } from 'vite-plus/test'
import { useAdminAuthStore } from './auth'
import { useAdminUserStore } from './user'

const mocks = vi.hoisted(() => {
  const accessStore = {
    accessToken: null as null | string,
    canAccessPath: vi.fn<(path: string) => boolean>(),
    initializeAccess: vi.fn<(accessPayload: CoreAuthApi.AccessResult, roles: readonly string[]) => void>(),
    invalidateSession: vi.fn<() => void>(),
    isAccessInitialized: false,
    isLoggedIn: false,
    sessionVersion: 0,
    resetAccess: vi.fn<() => void>(),
    resetAccessState: vi.fn<() => void>(),
    resolveHomePath: vi.fn<(path: string) => string>(),
    setAccessToken: vi.fn<(token: null | string) => void>(),
    updateAccessToken: vi.fn<(token: null | string) => void>(),
  }

  return {
    accessStore,
    getAccess: vi.fn<() => Promise<CoreAuthApi.AccessResult>>(),
    getIdentity: vi.fn<() => Promise<CoreAuthApi.IdentityResult>>(),
    login: vi.fn<(params: CoreAuthApi.LoginBody) => Promise<CoreAuthApi.LoginResult>>(),
    logout: vi.fn<() => Promise<CoreAuthApi.LogoutResult>>(),
    routerReplace: vi.fn<(path: string) => Promise<void>>(),
    tabReset: vi.fn<(options: { storageKey: string }) => void>(),
  }
})

vi.mock('vue-router', () => ({
  useRouter: () => ({
    currentRoute: { value: { fullPath: '/system/role' } },
    replace: mocks.routerReplace,
  }),
}))

vi.mock('@monorepo-admin-core/stores', () => ({
  useAdminTabStore: () => ({
    reset: mocks.tabReset,
  }),
}))

vi.mock('@/api/core/auth', () => ({
  coreAuthApi: {
    getAccess: mocks.getAccess,
    getIdentity: mocks.getIdentity,
    login: mocks.login,
    logout: mocks.logout,
  },
}))

vi.mock('@/router/access', () => ({
  DEFAULT_ADMIN_HOME_PATH: '/dashboard/workbench',
  LOGIN_ROUTE_PATH: '/auth/login',
  normalizeAdminPath: (path: string) => path,
  resolveLoginRedirect: (path: string) => (path === '/auth/login' ? undefined : encodeURIComponent(path)),
}))

vi.mock('./access', () => ({
  useAdminAccessStore: () => mocks.accessStore,
}))

const identity: CoreAuthApi.IdentityResult = {
  avatar: null,
  homePath: '/system/role',
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
  mocks.accessStore.sessionVersion = 0
  mocks.accessStore.canAccessPath.mockReturnValue(false)
  mocks.accessStore.resolveHomePath.mockImplementation((path) => path)
  mocks.accessStore.setAccessToken.mockImplementation((token) => {
    if (mocks.accessStore.accessToken !== token) mocks.accessStore.sessionVersion += 1
    mocks.accessStore.accessToken = token
    mocks.accessStore.isLoggedIn = Boolean(token)
    mocks.accessStore.isAccessInitialized = false
  })
  mocks.accessStore.initializeAccess.mockImplementation(() => {
    mocks.accessStore.isAccessInitialized = true
  })
  mocks.accessStore.invalidateSession.mockImplementation(() => {
    mocks.accessStore.sessionVersion += 1
    mocks.accessStore.accessToken = null
    mocks.accessStore.isLoggedIn = false
  })
  mocks.accessStore.resetAccess.mockImplementation(() => {
    mocks.accessStore.sessionVersion += 1
    mocks.accessStore.accessToken = null
    mocks.accessStore.isLoggedIn = false
    mocks.accessStore.isAccessInitialized = false
  })

  mocks.login.mockResolvedValue({ accessToken: 'access-token:empty' })
  mocks.getIdentity.mockResolvedValue(identity)
  mocks.getAccess.mockResolvedValue({ menus: [], permissionCodes: [] })
  mocks.logout.mockResolvedValue({})
  mocks.routerReplace.mockResolvedValue()
})

test('logs in, initializes access, and runs the success callback', async () => {
  const store = useAdminAuthStore()
  const onSuccess = vi.fn<() => Promise<void>>().mockResolvedValue()

  await expect(store.authLogin({ captchaToken: 'captcha-token', password: 'password', username: 'empty' }, onSuccess)).resolves.toEqual({
    userInfo: {
      avatar: undefined,
      homePath: '/system/role',
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
  expect(mocks.getAccess).toHaveBeenCalledOnce()
  expect(mocks.accessStore.initializeAccess).toHaveBeenCalledExactlyOnceWith({ menus: [], permissionCodes: [] }, [])
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
  expect(mocks.getAccess).toHaveBeenCalledOnce()

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
  mocks.accessStore.sessionVersion = 1

  let resolveIdentity: ((value: typeof identity) => void) | undefined
  mocks.getIdentity.mockReturnValue(
    new Promise((resolve) => {
      resolveIdentity = resolve
    }),
  )

  const store = useAdminAuthStore()
  const restore = store.restoreAccess()
  mocks.accessStore.accessToken = 'access-token:new'
  mocks.accessStore.sessionVersion = 2
  resolveIdentity?.(identity)

  await expect(restore).resolves.toBe(false)
  expect(mocks.accessStore.initializeAccess).not.toHaveBeenCalled()
  expect(useAdminUserStore().userInfo).toBeNull()
})

test('starts a fresh access setup when logging in during an older session restore', async () => {
  mocks.accessStore.accessToken = 'access-token:old'
  mocks.accessStore.sessionVersion = 1

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

test('keeps user information until logout navigation finishes', async () => {
  mocks.accessStore.accessToken = 'access-token:active'
  let resolveReplace: (() => void) | undefined
  mocks.routerReplace.mockReturnValue(
    new Promise((resolve) => {
      resolveReplace = resolve
    }),
  )
  const userStore = useAdminUserStore()
  userStore.setUserInfo({
    homePath: '/dashboard/workbench',
    real_name: 'Admin',
    roles: ['admin'],
    user_id: 'admin',
    username: 'admin',
  })
  const store = useAdminAuthStore()

  const logoutPromise = store.logout()

  await vi.waitFor(() => {
    expect(mocks.routerReplace).toHaveBeenCalledExactlyOnceWith('/auth/login')
  })

  expect(mocks.logout).toHaveBeenCalledOnce()
  expect(mocks.accessStore.invalidateSession).toHaveBeenCalledOnce()
  expect(mocks.accessStore.resetAccessState).not.toHaveBeenCalled()
  expect(userStore.userInfo?.real_name).toBe('Admin')

  resolveReplace?.()
  await logoutPromise

  expect(mocks.accessStore.resetAccessState).toHaveBeenCalledOnce()
  expect(mocks.accessStore.resetAccess).not.toHaveBeenCalled()
  expect(mocks.tabReset).toHaveBeenCalledExactlyOnceWith({ storageKey: 'template-admin:open-tabs' })
  expect(userStore.userInfo).toBeNull()
  expect(mocks.accessStore.invalidateSession.mock.invocationCallOrder[0]).toBeLessThan(mocks.routerReplace.mock.invocationCallOrder[0]!)
  expect(mocks.routerReplace.mock.invocationCallOrder[0]).toBeLessThan(mocks.accessStore.resetAccessState.mock.invocationCallOrder[0]!)
})

test('cleans up locally and redirects even when remote logout fails', async () => {
  mocks.accessStore.accessToken = 'access-token:active'
  mocks.logout.mockRejectedValue(new Error('remote logout unavailable'))
  const store = useAdminAuthStore()

  await expect(store.logout()).resolves.toBeUndefined()

  expect(mocks.logout).toHaveBeenCalledOnce()
  expect(mocks.accessStore.invalidateSession).toHaveBeenCalledOnce()
  expect(mocks.accessStore.resetAccessState).toHaveBeenCalledOnce()
  expect(mocks.accessStore.resetAccess).not.toHaveBeenCalled()
  expect(mocks.tabReset).toHaveBeenCalledExactlyOnceWith({ storageKey: 'template-admin:open-tabs' })
  expect(mocks.routerReplace).toHaveBeenCalledExactlyOnceWith('/auth/login')
})

test('clears the session immediately when logging out without redirecting', async () => {
  mocks.accessStore.accessToken = 'access-token:active'
  const store = useAdminAuthStore()

  await store.logout(false)

  expect(mocks.logout).toHaveBeenCalledOnce()
  expect(mocks.accessStore.resetAccess).toHaveBeenCalledOnce()
  expect(mocks.accessStore.invalidateSession).not.toHaveBeenCalled()
  expect(mocks.accessStore.resetAccessState).not.toHaveBeenCalled()
  expect(mocks.routerReplace).not.toHaveBeenCalled()
})

test('clears the session and preserves the current path when the access token expires', async () => {
  mocks.accessStore.accessToken = 'access-token:expired'
  const store = useAdminAuthStore()

  await store.handleSessionExpired()

  expect(mocks.accessStore.invalidateSession).toHaveBeenCalledOnce()
  expect(mocks.accessStore.resetAccessState).toHaveBeenCalledOnce()
  expect(mocks.accessStore.resetAccess).not.toHaveBeenCalled()
  expect(mocks.tabReset).toHaveBeenCalledExactlyOnceWith({ storageKey: 'template-admin:open-tabs' })
  expect(mocks.routerReplace).toHaveBeenCalledExactlyOnceWith({
    path: '/auth/login',
    query: { redirect: encodeURIComponent('/system/role') },
  })
  expect(mocks.accessStore.invalidateSession.mock.invocationCallOrder[0]).toBeLessThan(mocks.routerReplace.mock.invocationCallOrder[0]!)
  expect(mocks.routerReplace.mock.invocationCallOrder[0]).toBeLessThan(mocks.accessStore.resetAccessState.mock.invocationCallOrder[0]!)
})
