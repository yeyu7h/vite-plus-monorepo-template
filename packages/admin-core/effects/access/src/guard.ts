import type { RouteLocationNormalized, RouteLocationRaw } from 'vue-router'
import { normalizeAdminPath } from './path'

export const DEFAULT_ADMIN_HOME_PATH = '/dashboard/workbench'
export const FORBIDDEN_ROUTE_PATH = '/403'
export const LOGIN_ROUTE_PATH = '/auth/login'
export const NOT_FOUND_ROUTE_PATH = '/404'

export interface AdminAccessGuardState {
  canAccessPath: (path: string) => boolean
  homePath: string
  isLoggedIn: boolean
  restoreAccess: () => Promise<boolean>
}

export interface AdminAccessGuardOptions {
  matchesAccessPath: (path: string) => boolean
  resolveRoute: (fullPath: string) => RouteLocationRaw
}

export async function resolveAdminAccessGuard(to: RouteLocationNormalized, accessState: AdminAccessGuardState, options: AdminAccessGuardOptions): Promise<RouteLocationRaw | true> {
  const normalizedPath = normalizeAdminPath(to.path)

  if (normalizedPath === '/') {
    return accessState.isLoggedIn ? accessState.homePath : LOGIN_ROUTE_PATH
  }

  if (isPublicRoutePath(normalizedPath)) {
    if (normalizedPath === LOGIN_ROUTE_PATH && accessState.isLoggedIn) {
      try {
        await accessState.restoreAccess()
        return accessState.homePath
      } catch {
        return true
      }
    }

    return true
  }

  const shouldResolveFallbackRoute = to.meta?.source === 'fallback' && (accessState.isLoggedIn || isKnownAccessRoutePath(normalizedPath, options.matchesAccessPath))
  if (to.meta?.ignoreAccess && !shouldResolveFallbackRoute) {
    return true
  }

  if (!accessState.isLoggedIn) {
    const redirect = resolveLoginRedirect(to.fullPath)

    return {
      path: LOGIN_ROUTE_PATH,
      query: redirect ? { redirect } : {},
      replace: true,
    }
  }

  let accessGenerated = false
  try {
    accessGenerated = await accessState.restoreAccess()
  } catch {
    const redirect = resolveLoginRedirect(to.fullPath)

    return {
      path: LOGIN_ROUTE_PATH,
      query: redirect ? { redirect } : {},
      replace: true,
    }
  }

  if (!isAccessibleRoutePath(normalizedPath, accessState.canAccessPath)) {
    if (isKnownAccessRoutePath(normalizedPath, options.matchesAccessPath)) {
      return {
        path: FORBIDDEN_ROUTE_PATH,
        replace: true,
      }
    }

    return true
  }

  if (accessGenerated) {
    return {
      ...asRouteLocationObject(options.resolveRoute(to.fullPath)),
      replace: true,
    }
  }

  return true
}

export function isPublicRoutePath(path: string) {
  const normalizedPath = normalizeAdminPath(path)

  return normalizedPath.startsWith('/auth') || normalizedPath === FORBIDDEN_ROUTE_PATH || normalizedPath === NOT_FOUND_ROUTE_PATH
}

export function isAccessibleRoutePath(path: string, canAccessPath: (path: string) => boolean) {
  return canAccessPath(normalizeAdminPath(path))
}

export function isKnownAccessRoutePath(path: string, matchesAccessPath: (path: string) => boolean) {
  return matchesAccessPath(normalizeAdminPath(path))
}

export function resolveLoginRedirect(fullPath: string) {
  const normalizedPath = normalizeAdminPath(fullPath)

  if (!fullPath || isPublicRoutePath(normalizedPath) || normalizedPath === DEFAULT_ADMIN_HOME_PATH) return void 0

  return encodeURIComponent(fullPath)
}

export function resolvePostLoginPath(redirect: unknown, options: { canAccessPath: (path: string) => boolean; fallbackPath: string }) {
  const fallbackPath = options.fallbackPath || DEFAULT_ADMIN_HOME_PATH
  const redirectPath = normalizeRedirectPath(redirect)

  if (!redirectPath) return fallbackPath

  const normalizedPath = normalizeAdminPath(redirectPath)
  if (isPublicRoutePath(normalizedPath)) return fallbackPath

  return options.canAccessPath(normalizedPath) ? redirectPath : fallbackPath
}

function normalizeRedirectPath(redirect: unknown) {
  if (typeof redirect !== 'string') return void 0

  const trimmedRedirect = redirect.trim()
  if (!trimmedRedirect) return void 0

  let decodedRedirect = trimmedRedirect
  try {
    decodedRedirect = decodeURIComponent(trimmedRedirect).trim()
  } catch {
    return void 0
  }

  if (!decodedRedirect || !decodedRedirect.startsWith('/') || decodedRedirect.startsWith('//')) return void 0
  if (/^[a-z][a-z\d+.-]*:/i.test(decodedRedirect)) return void 0

  return decodedRedirect
}

function asRouteLocationObject(location: RouteLocationRaw) {
  return typeof location === 'string' ? { path: location } : location
}
