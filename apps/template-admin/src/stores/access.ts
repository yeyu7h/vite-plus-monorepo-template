import type { AdminMenuGroup } from '@monorepo-admin-core/types'
import type { AdminNavigationRouteRecord } from '@monorepo-admin-core/types'
import type { RouteRecordRaw } from 'vue-router'
import type { AdminLoginParams } from '@/api/mock'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getBackendMenusApi, getUserInfoApi, loginApi } from '@/api/mock'
import { accessFileRoutes } from '@/router'
import { DEFAULT_ADMIN_HOME_PATH, FORBIDDEN_ROUTE_PATH, normalizeAdminPath, registerAdminAccessRoutes, resetAdminAccessRoutes, resolveAdminAccess } from '@/router/access'
import { useAdminUserStore } from './user'

const ACCESS_TOKEN_KEY = 'template-admin:access-token'

export const useAdminAccessStore = defineStore('admin-access', () => {
  const router = useRouter()
  const userStore = useAdminUserStore()
  const accessToken = ref(localStorage.getItem(ACCESS_TOKEN_KEY))
  const accessibleRoutes = ref<RouteRecordRaw[]>([])
  const menuGroups = ref<AdminMenuGroup[]>([])
  const navigationRoutes = ref<AdminNavigationRouteRecord[]>([])
  const routePaths = ref<string[]>([])

  const isLoggedIn = computed(() => Boolean(accessToken.value))
  const isAccessReady = computed(() => routePaths.value.length > 0)
  const homePath = computed(() => {
    const preferredHomePath = normalizeAdminPath(userStore.homePath)

    if (!routePaths.value.length || routePaths.value.includes(preferredHomePath)) {
      return preferredHomePath
    }

    return routePaths.value[0] ?? DEFAULT_ADMIN_HOME_PATH
  })

  async function login(params: AdminLoginParams) {
    const result = await loginApi(params)
    setAccessToken(result.access_token)
    await setupAccess()
  }

  async function restoreAccess() {
    if (!accessToken.value || isAccessReady.value) return false

    try {
      await setupAccess()
      return true
    } catch {
      clearAccess()
      throw new Error('登录状态无效')
    }
  }

  async function setupAccess() {
    if (!accessToken.value) return

    const [nextUserInfo, backendMenus] = await Promise.all([getUserInfoApi(accessToken.value), getBackendMenusApi()])
    const resolvedAccess = resolveAdminAccess(accessFileRoutes, backendMenus, nextUserInfo.roles)

    userStore.setUserInfo(nextUserInfo)
    accessibleRoutes.value = resolvedAccess.accessibleRoutes
    menuGroups.value = resolvedAccess.menuGroups
    navigationRoutes.value = resolvedAccess.navigationRoutes
    routePaths.value = [...resolvedAccess.routePathSet]

    registerAdminAccessRoutes(router, resolvedAccess.accessibleRoutes)
  }

  async function logout(redirect = true) {
    clearAccess()

    if (redirect) {
      await router.replace('/auth/login')
    }
  }

  function canAccessPath(path: string) {
    return routePaths.value.includes(normalizeAdminPath(path))
  }

  function resolveAccessiblePath(path: string) {
    if (canAccessPath(path)) return path
    if (canAccessPath(homePath.value)) return homePath.value

    return routePaths.value[0] ?? FORBIDDEN_ROUTE_PATH
  }

  function clearAccess() {
    accessToken.value = null
    accessibleRoutes.value = []
    menuGroups.value = []
    navigationRoutes.value = []
    routePaths.value = []
    userStore.clearUser()
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    resetAdminAccessRoutes()
  }

  function setAccessToken(token: string) {
    accessToken.value = token
    localStorage.setItem(ACCESS_TOKEN_KEY, token)
  }

  return {
    canAccessPath,
    homePath,
    isLoggedIn,
    login,
    logout,
    menuGroups,
    navigationRoutes,
    restoreAccess,
    resolveAccessiblePath,
  }
})
