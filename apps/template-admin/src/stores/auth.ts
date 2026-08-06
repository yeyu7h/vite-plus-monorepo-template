import type { CoreAuthApi } from '@/api/core/auth'
import type { AdminUserInfo } from '@/api/core/auth'
import { useAdminTabStore } from '@monorepo-admin-core/layout-effect'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { coreAuthApi } from '@/api/core/auth'
import { DEFAULT_ADMIN_HOME_PATH, LOGIN_ROUTE_PATH, resolveLoginRedirect } from '@/router/access'
import { ADMIN_TAB_STORAGE_KEY } from '../constants/storage'
import { useAdminAccessStore } from './access'
import { useAdminUserStore } from './user'

function toAdminUserInfo(identity: CoreAuthApi.IdentityResult): AdminUserInfo {
  return {
    avatar: identity.avatar ?? undefined,
    home_path: DEFAULT_ADMIN_HOME_PATH,
    real_name: identity.nickName,
    roles: identity.roles,
    user_id: identity.id,
    username: identity.username,
  }
}

export const useAdminAuthStore = defineStore('admin-auth', () => {
  const accessStore = useAdminAccessStore()
  const router = useRouter()
  const tabStore = useAdminTabStore()
  const userStore = useAdminUserStore()
  const loginLoading = ref(false)
  let accessSetupPromise: Promise<boolean> | undefined

  const homePath = computed(() => accessStore.resolveHomePath(userStore.homePath))
  const isLoggedIn = computed(() => accessStore.isLoggedIn)

  async function authLogin(params: CoreAuthApi.LoginBody, onSuccess?: () => Promise<void> | void) {
    loginLoading.value = true

    try {
      const result = await coreAuthApi.login(params)
      accessSetupPromise = void 0
      accessStore.setAccessToken(result.accessToken)

      try {
        await setupAccess()
      } catch (error) {
        resetSession()
        throw error
      }

      await onSuccess?.()

      return {
        userInfo: userStore.userInfo,
      }
    } finally {
      loginLoading.value = false
    }
  }

  function canAccessPath(path: string) {
    return accessStore.canAccessPath(path)
  }

  async function fetchUserInfo() {
    const userInfo = await requestUserInfo()
    userStore.setUserInfo(userInfo)

    return userInfo
  }

  async function restoreAccess() {
    if (!accessStore.accessToken || accessStore.isAccessInitialized) return false

    try {
      return await setupAccess()
    } catch {
      resetSession()
      throw new Error('登录状态无效')
    }
  }

  async function logout(redirect = true) {
    try {
      if (accessStore.accessToken) await coreAuthApi.logout()
    } catch {
      // Local session cleanup must complete even when the remote logout endpoint is unavailable.
    } finally {
      resetSession()
    }

    if (redirect) {
      await router.replace(LOGIN_ROUTE_PATH)
    }
  }

  async function handleSessionExpired() {
    const redirect = resolveLoginRedirect(router.currentRoute.value.fullPath)
    resetSession()

    await router.replace({
      path: LOGIN_ROUTE_PATH,
      query: redirect ? { redirect } : {},
    })
  }

  async function setupAccess() {
    const setupToken = accessStore.accessToken
    const setupSessionVersion = accessStore.sessionVersion
    if (!setupToken) return false
    if (accessSetupPromise) return accessSetupPromise

    const nextSetupPromise = (async () => {
      const [nextUserInfo, accessPayload] = await Promise.all([requestUserInfo(), coreAuthApi.getAccess()])

      // 请求期间可能已经退出登录或切换账号，旧结果不能覆盖新会话
      if (accessStore.sessionVersion !== setupSessionVersion) return false

      userStore.setUserInfo(nextUserInfo)
      accessStore.initializeAccess(accessPayload, nextUserInfo.roles)

      return true
    })()

    accessSetupPromise = nextSetupPromise

    try {
      return await nextSetupPromise
    } finally {
      if (accessSetupPromise === nextSetupPromise) {
        accessSetupPromise = void 0
      }
    }
  }

  async function requestUserInfo() {
    return toAdminUserInfo(await coreAuthApi.getIdentity())
  }

  function resetSession() {
    accessSetupPromise = void 0
    accessStore.resetAccess()
    tabStore.reset({ storageKey: ADMIN_TAB_STORAGE_KEY })
    userStore.clearUser()
  }

  return {
    authLogin,
    canAccessPath,
    fetchUserInfo,
    homePath,
    isLoggedIn,
    handleSessionExpired,
    loginLoading,
    logout,
    restoreAccess,
  }
})
