import type { AdminMenuGroup } from '@monorepo-admin-core/types'
import type { AdminNavigationRouteRecord } from '@monorepo-admin-core/types'
import type { RouteRecordRaw } from 'vue-router'
import type { AdminLoginParams, AdminUserInfo } from '@/api/mock'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getBackendMenusApi, getUserInfoApi, loginApi } from '@/api/mock'
import { accessFileRoutes } from '@/router'
import { registerAdminAccessRoutes, resetAdminAccessRoutes, resolveAdminAccess } from '@/router/access'

const ACCESS_TOKEN_KEY = 'template-admin:access-token'

export const useAdminAccessStore = defineStore('admin-access', () => {
  const router = useRouter()
  const accessToken = ref(localStorage.getItem(ACCESS_TOKEN_KEY))
  const accessibleRoutes = ref<RouteRecordRaw[]>([])
  const menuGroups = ref<AdminMenuGroup[]>([])
  const navigationRoutes = ref<AdminNavigationRouteRecord[]>([])
  const routePaths = ref<string[]>([])
  const userInfo = ref<AdminUserInfo | null>(null)

  const isLoggedIn = computed(() => Boolean(accessToken.value))
  const isAccessReady = computed(() => routePaths.value.length > 0)

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

    userInfo.value = nextUserInfo
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
    return routePaths.value.includes(path)
  }

  function clearAccess() {
    accessToken.value = null
    accessibleRoutes.value = []
    menuGroups.value = []
    navigationRoutes.value = []
    routePaths.value = []
    userInfo.value = null
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    resetAdminAccessRoutes()
  }

  function setAccessToken(token: string) {
    accessToken.value = token
    localStorage.setItem(ACCESS_TOKEN_KEY, token)
  }

  return {
    accessToken,
    accessibleRoutes,
    canAccessPath,
    clearAccess,
    isAccessReady,
    isLoggedIn,
    login,
    logout,
    menuGroups,
    navigationRoutes,
    restoreAccess,
    routePaths,
    setupAccess,
    userInfo,
  }
})
