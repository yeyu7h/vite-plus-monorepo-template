import type { AdminMenuGroup } from '@monorepo-admin-core/types'
import type { AdminNavigationRouteRecord } from '@monorepo-admin-core/types'
import type { RouteRecordRaw } from 'vue-router'
import { useAdminTabStore } from '@monorepo-admin-core/layout-effect'
import type { AdminLoginParams } from '@/api/auth'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getAdminAccessApi, getUserInfoApi, loginApi, logoutApi, refreshTokenApi } from '@/api/auth'
import { initializeAdminAuthentication, markAdminSessionActive } from '@/api/request'
import { accessFileRoutes } from '@/router'
import { createAdminRoutePathMatcher, DEFAULT_ADMIN_HOME_PATH, FORBIDDEN_ROUTE_PATH, normalizeAdminPath, registerAdminAccessRoutes, resetAdminAccessRoutes, resolveAdminAccess } from '@/router/access'
import { ADMIN_ACCESS_TOKEN_STORAGE_KEY, ADMIN_TAB_STORAGE_KEY } from '../constants/storage'
import { useAdminUserStore } from './user'

export const useAdminAccessStore = defineStore('admin-access', () => {
  const router = useRouter()
  const tabStore = useAdminTabStore()
  const userStore = useAdminUserStore()
  const accessToken = ref(localStorage.getItem(ADMIN_ACCESS_TOKEN_STORAGE_KEY))
  const accessibleRoutes = ref<RouteRecordRaw[]>([])
  const isAccessInitialized = ref(false)
  const menuGroups = ref<AdminMenuGroup[]>([])
  const navigationRoutes = ref<AdminNavigationRouteRecord[]>([])
  const permissionCodes = ref<string[]>([])
  const routePaths = ref<string[]>([])
  let accessSetupPromise: Promise<boolean> | undefined
  let matchesAccessiblePath: (path: string) => boolean = () => false
  let sessionRevision = 0

  initializeAdminAuthentication({
    onSessionExpired: async () => {
      const redirect = router.currentRoute.value.fullPath
      clearAccess()
      await router.replace({ path: '/auth/login', query: { redirect } })
    },
    refreshAccessToken: async () => {
      const result = await refreshTokenApi()
      setAccessToken(result.accessToken, false)
      return result.accessToken
    },
  })

  const isLoggedIn = computed(() => Boolean(accessToken.value))
  const homePath = computed(() => {
    const preferredHomePath = normalizeAdminPath(userStore.homePath)

    if (!routePaths.value.length || matchesAccessiblePath(preferredHomePath)) {
      return preferredHomePath
    }

    return routePaths.value[0] ?? DEFAULT_ADMIN_HOME_PATH
  })

  async function login(params: AdminLoginParams) {
    const result = await loginApi(params)
    setAccessToken(result.accessToken)
    await setupAccess()
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
    if (!accessToken.value) return false
    if (accessSetupPromise) return accessSetupPromise
    const setupSessionRevision = sessionRevision

    const nextSetupPromise = (async () => {
      const [nextUserInfo, access] = await Promise.all([getUserInfoApi(), getAdminAccessApi()])
      const resolvedAccess = resolveAdminAccess(accessFileRoutes, access.menus, nextUserInfo.roles)

      // Access Token 续期仍属于同一会话；只有退出或切换账号时才丢弃旧结果。
      if (!accessToken.value || sessionRevision !== setupSessionRevision) return false

      registerAdminAccessRoutes(router, resolvedAccess.accessibleRoutes)
      matchesAccessiblePath = createAdminRoutePathMatcher(resolvedAccess.accessibleRoutes)
      userStore.setUserInfo(nextUserInfo)
      accessibleRoutes.value = resolvedAccess.accessibleRoutes
      menuGroups.value = resolvedAccess.menuGroups
      navigationRoutes.value = resolvedAccess.navigationRoutes
      permissionCodes.value = access.permissionCodes
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
    try {
      await logoutApi()
    } catch {
      // Local cleanup must not depend on the server being reachable.
    } finally {
      clearAccess()
    }

    if (redirect) {
      await router.replace('/auth/login')
    }
  }

  function canAccessPath(path: string) {
    return matchesAccessiblePath(normalizeAdminPath(path))
  }

  function hasPermission(code: string) {
    return permissionCodes.value.includes(code)
  }

  function resolveAccessiblePath(path: string) {
    if (canAccessPath(path)) return path
    if (canAccessPath(homePath.value)) return homePath.value

    return routePaths.value[0] ?? FORBIDDEN_ROUTE_PATH
  }

  function clearAccess() {
    sessionRevision += 1
    accessToken.value = null
    accessSetupPromise = void 0
    matchesAccessiblePath = () => false
    accessibleRoutes.value = []
    isAccessInitialized.value = false
    menuGroups.value = []
    navigationRoutes.value = []
    permissionCodes.value = []
    routePaths.value = []
    tabStore.reset({ storageKey: ADMIN_TAB_STORAGE_KEY })
    userStore.clearUser()
    localStorage.removeItem(ADMIN_ACCESS_TOKEN_STORAGE_KEY)
    resetAdminAccessRoutes()
  }

  function setAccessToken(token: string, sessionChanged = true) {
    if (sessionChanged) {
      sessionRevision += 1
      accessSetupPromise = void 0
      isAccessInitialized.value = false
    }

    accessToken.value = token
    markAdminSessionActive()
    localStorage.setItem(ADMIN_ACCESS_TOKEN_STORAGE_KEY, token)
  }

  return {
    canAccessPath,
    hasPermission,
    homePath,
    isAccessInitialized,
    isLoggedIn,
    login,
    logout,
    menuGroups,
    navigationRoutes,
    permissionCodes,
    restoreAccess,
    resolveAccessiblePath,
  }
})
