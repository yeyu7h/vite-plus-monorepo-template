import type { AdminMenuGroup } from '@monorepo-admin-core/types'
import type { AdminNavigationRouteRecord } from '@monorepo-admin-core/types'
import type { RouteRecordRaw } from 'vue-router'
import { useAdminTabStore } from '@monorepo-admin-core/layout-effect'
import type { CoreAuthApi } from '@/api/core/auth'
import type { AdminUserInfo } from '@/api/mock'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { coreAuthApi } from '@/api/core/auth'
import { getBackendMenusApi } from '@/api/mock'
import { accessFileRoutes } from '@/router'
import { createAdminRoutePathMatcher, DEFAULT_ADMIN_HOME_PATH, FORBIDDEN_ROUTE_PATH, normalizeAdminPath, registerAdminAccessRoutes, resetAdminAccessRoutes, resolveAdminAccess } from '@/router/access'
import { ADMIN_ACCESS_TOKEN_STORAGE_KEY, ADMIN_TAB_STORAGE_KEY } from '../constants/storage'
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

export const useAdminAccessStore = defineStore('admin-access', () => {
  const router = useRouter()
  const tabStore = useAdminTabStore()
  const userStore = useAdminUserStore()
  const accessToken = ref(localStorage.getItem(ADMIN_ACCESS_TOKEN_STORAGE_KEY))
  const accessibleRoutes = ref<RouteRecordRaw[]>([])
  const isAccessInitialized = ref(false)
  const menuGroups = ref<AdminMenuGroup[]>([])
  const navigationRoutes = ref<AdminNavigationRouteRecord[]>([])
  const routePaths = ref<string[]>([])
  let accessSetupPromise: Promise<boolean> | undefined
  let matchesAccessiblePath: (path: string) => boolean = () => false

  const isLoggedIn = computed(() => Boolean(accessToken.value))
  const homePath = computed(() => {
    const preferredHomePath = normalizeAdminPath(userStore.homePath)

    if (!routePaths.value.length || matchesAccessiblePath(preferredHomePath)) {
      return preferredHomePath
    }

    return routePaths.value[0] ?? DEFAULT_ADMIN_HOME_PATH
  })

  async function login(params: CoreAuthApi.LoginBody) {
    const result = await coreAuthApi.login(params)
    setAccessToken(result.accessToken)

    try {
      await setupAccess()
    } catch (error) {
      clearAccess()
      throw error
    }
  }

  async function restoreAccess() {
    if (!accessToken.value || isAccessInitialized.value) return false

    try {
      return await setupAccess()
    } catch {
      clearAccess()
      throw new Error('登录状态无效')
    }
  }

  async function setupAccess() {
    const setupToken = accessToken.value
    if (!setupToken) return false
    if (accessSetupPromise) return accessSetupPromise

    const nextSetupPromise = (async () => {
      const [identity, backendMenus] = await Promise.all([coreAuthApi.getIdentity(), getBackendMenusApi()])
      const nextUserInfo = toAdminUserInfo(identity)
      const resolvedAccess = resolveAdminAccess(accessFileRoutes, backendMenus, nextUserInfo.roles)

      // 请求期间可能已经退出登录或切换账号，旧结果不能覆盖新会话
      if (accessToken.value !== setupToken) return false

      registerAdminAccessRoutes(router, resolvedAccess.accessibleRoutes)
      matchesAccessiblePath = createAdminRoutePathMatcher(resolvedAccess.accessibleRoutes)
      userStore.setUserInfo(nextUserInfo)
      accessibleRoutes.value = resolvedAccess.accessibleRoutes
      menuGroups.value = resolvedAccess.menuGroups
      navigationRoutes.value = resolvedAccess.navigationRoutes
      routePaths.value = [...resolvedAccess.routePathSet]
      isAccessInitialized.value = true

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

  async function logout(redirect = true) {
    clearAccess()

    if (redirect) {
      await router.replace('/auth/login')
    }
  }

  function canAccessPath(path: string) {
    return matchesAccessiblePath(normalizeAdminPath(path))
  }

  function resolveAccessiblePath(path: string) {
    if (canAccessPath(path)) return path
    if (canAccessPath(homePath.value)) return homePath.value

    return routePaths.value[0] ?? FORBIDDEN_ROUTE_PATH
  }

  function clearAccess() {
    accessToken.value = null
    accessSetupPromise = void 0
    matchesAccessiblePath = () => false
    accessibleRoutes.value = []
    isAccessInitialized.value = false
    menuGroups.value = []
    navigationRoutes.value = []
    routePaths.value = []
    tabStore.reset({ storageKey: ADMIN_TAB_STORAGE_KEY })
    userStore.clearUser()
    localStorage.removeItem(ADMIN_ACCESS_TOKEN_STORAGE_KEY)
    resetAdminAccessRoutes()
  }

  function setAccessToken(token: string) {
    if (accessToken.value !== token) {
      accessSetupPromise = void 0
      isAccessInitialized.value = false
    }

    accessToken.value = token
    localStorage.setItem(ADMIN_ACCESS_TOKEN_STORAGE_KEY, token)
  }

  return {
    canAccessPath,
    homePath,
    isAccessInitialized,
    isLoggedIn,
    login,
    logout,
    menuGroups,
    navigationRoutes,
    restoreAccess,
    resolveAccessiblePath,
  }
})
