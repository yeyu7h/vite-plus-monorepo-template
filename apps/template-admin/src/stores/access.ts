import type { AdminBackendMenu, AdminMenuGroup, AdminNavigationRouteRecord } from '@monorepo-admin-core/types'
import type { RouteRecordRaw } from 'vue-router'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { accessFileRoutes } from '@/router'
import { createAdminRoutePathMatcher, DEFAULT_ADMIN_HOME_PATH, FORBIDDEN_ROUTE_PATH, normalizeAdminPath, registerAdminAccessRoutes, resetAdminAccessRoutes, resolveAdminAccess } from '@/router/access'
import { ADMIN_ACCESS_TOKEN_STORAGE_KEY } from '../constants/storage'

export const useAdminAccessStore = defineStore('admin-access', () => {
  const router = useRouter()
  const accessToken = ref<string | null>(localStorage.getItem(ADMIN_ACCESS_TOKEN_STORAGE_KEY))
  const accessibleRoutes = ref<RouteRecordRaw[]>([])
  const isAccessInitialized = ref(false)
  const menuGroups = ref<AdminMenuGroup[]>([])
  const navigationRoutes = ref<AdminNavigationRouteRecord[]>([])
  const routePaths = ref<string[]>([])
  let matchesAccessiblePath: (path: string) => boolean = () => false

  const isLoggedIn = computed(() => Boolean(accessToken.value))

  function initializeAccess(backendMenus: readonly AdminBackendMenu[], roles: readonly string[]) {
    const resolvedAccess = resolveAdminAccess(accessFileRoutes, backendMenus, roles)

    registerAdminAccessRoutes(router, resolvedAccess.accessibleRoutes)
    matchesAccessiblePath = createAdminRoutePathMatcher(resolvedAccess.accessibleRoutes)
    accessibleRoutes.value = resolvedAccess.accessibleRoutes
    menuGroups.value = resolvedAccess.menuGroups
    navigationRoutes.value = resolvedAccess.navigationRoutes
    routePaths.value = [...resolvedAccess.routePathSet]
    isAccessInitialized.value = true
  }

  function canAccessPath(path: string) {
    return matchesAccessiblePath(normalizeAdminPath(path))
  }

  function resolveHomePath(path: string) {
    const preferredHomePath = normalizeAdminPath(path)

    if (!routePaths.value.length || canAccessPath(preferredHomePath)) {
      return preferredHomePath
    }

    return routePaths.value[0] ?? DEFAULT_ADMIN_HOME_PATH
  }

  function resolveAccessiblePath(path: string) {
    if (canAccessPath(path)) return path

    return routePaths.value[0] ?? FORBIDDEN_ROUTE_PATH
  }

  function resetAccess() {
    accessToken.value = null
    localStorage.removeItem(ADMIN_ACCESS_TOKEN_STORAGE_KEY)
    resetAccessState()
  }

  function setAccessToken(token: string | null) {
    if (accessToken.value !== token) {
      resetAccessState()
    }

    accessToken.value = token

    if (token) {
      localStorage.setItem(ADMIN_ACCESS_TOKEN_STORAGE_KEY, token)
    } else {
      localStorage.removeItem(ADMIN_ACCESS_TOKEN_STORAGE_KEY)
    }
  }

  function resetAccessState() {
    matchesAccessiblePath = () => false
    accessibleRoutes.value = []
    isAccessInitialized.value = false
    menuGroups.value = []
    navigationRoutes.value = []
    routePaths.value = []
    resetAdminAccessRoutes()
  }

  return {
    accessToken,
    canAccessPath,
    initializeAccess,
    isAccessInitialized,
    isLoggedIn,
    menuGroups,
    navigationRoutes,
    resetAccess,
    resolveAccessiblePath,
    resolveHomePath,
    setAccessToken,
  }
})
