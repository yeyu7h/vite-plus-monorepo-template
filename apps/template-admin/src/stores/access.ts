import type { AdminBackendMenu, AdminMenuGroup, AdminNavigationRouteRecord } from '@monorepo-admin-core/types'
import type { RouteRecordRaw } from 'vue-router'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { accessFileRoutes } from '@/router'
import type { CoreAuthApi } from '@/api/core/auth'
import { createAdminRoutePathMatcher, DEFAULT_ADMIN_HOME_PATH, FORBIDDEN_ROUTE_PATH, normalizeAdminPath, registerAdminAccessRoutes, resetAdminAccessRoutes, resolveAdminAccess } from '@/router/access'
import { ADMIN_ACCESS_TOKEN_STORAGE_KEY } from '../constants/storage'

export const useAdminAccessStore = defineStore('admin-access', () => {
  const router = useRouter()
  const accessToken = ref<string | null>(localStorage.getItem(ADMIN_ACCESS_TOKEN_STORAGE_KEY))
  const sessionVersion = ref(0)
  const accessibleRoutes = ref<RouteRecordRaw[]>([])
  const isAccessInitialized = ref(false)
  const menuGroups = ref<AdminMenuGroup[]>([])
  const navigationRoutes = ref<AdminNavigationRouteRecord[]>([])
  const permissionCodes = ref<string[]>([])
  const routePaths = ref<string[]>([])
  let matchesAccessiblePath: (path: string) => boolean = () => false

  const isLoggedIn = computed(() => Boolean(accessToken.value))

  function initializeAccess(accessPayload: CoreAuthApi.AccessResult | readonly AdminBackendMenu[], roles: readonly string[], legacyPermissionCodes: readonly string[] = []) {
    const backendMenus = 'menus' in accessPayload ? accessPayload.menus : accessPayload
    const nextPermissionCodes = 'permissionCodes' in accessPayload ? accessPayload.permissionCodes : legacyPermissionCodes
    const resolvedAccess = resolveAdminAccess(accessFileRoutes, backendMenus, roles)

    registerAdminAccessRoutes(router, resolvedAccess.accessibleRoutes)
    matchesAccessiblePath = createAdminRoutePathMatcher(resolvedAccess.accessibleRoutes)
    accessibleRoutes.value = resolvedAccess.accessibleRoutes
    menuGroups.value = resolvedAccess.menuGroups
    navigationRoutes.value = resolvedAccess.navigationRoutes
    permissionCodes.value = [...nextPermissionCodes]
    routePaths.value = [...resolvedAccess.routePathSet]
    isAccessInitialized.value = true
  }

  function canAccessPath(path: string) {
    return matchesAccessiblePath(normalizeAdminPath(path))
  }

  function hasPermission(code: string) {
    return permissionCodes.value.includes(code)
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

  function invalidateSession() {
    sessionVersion.value += 1
    updateAccessToken(null)
  }

  function resetAccess() {
    invalidateSession()
    resetAccessState()
  }

  function setAccessToken(token: string | null) {
    if (accessToken.value !== token) {
      sessionVersion.value += 1
      resetAccessState()
    }

    updateAccessToken(token)
  }

  function updateAccessToken(token: string | null) {
    accessToken.value = token

    if (token) localStorage.setItem(ADMIN_ACCESS_TOKEN_STORAGE_KEY, token)
    else localStorage.removeItem(ADMIN_ACCESS_TOKEN_STORAGE_KEY)
  }

  function resetAccessState() {
    matchesAccessiblePath = () => false
    accessibleRoutes.value = []
    isAccessInitialized.value = false
    menuGroups.value = []
    navigationRoutes.value = []
    permissionCodes.value = []
    routePaths.value = []
    resetAdminAccessRoutes()
  }

  return {
    accessToken,
    canAccessPath,
    hasPermission,
    initializeAccess,
    invalidateSession,
    isAccessInitialized,
    isLoggedIn,
    menuGroups,
    navigationRoutes,
    permissionCodes,
    resetAccess,
    resolveAccessiblePath,
    resolveHomePath,
    resetAccessState,
    sessionVersion,
    setAccessToken,
    updateAccessToken,
  }
})
