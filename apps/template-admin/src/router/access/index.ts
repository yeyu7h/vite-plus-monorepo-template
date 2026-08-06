import type { AdminBackendMenu } from '@monorepo-admin-core/types'
import type { RouteRecordRaw } from 'vue-router'
import { resolveAdminAccess as resolveAdminAccessBase } from '@monorepo-admin-core/access-effect'

export {
  DEFAULT_ADMIN_HOME_PATH,
  FORBIDDEN_ROUTE_PATH,
  LOGIN_ROUTE_PATH,
  NOT_FOUND_ROUTE_PATH,
  createAdminRoutePathMatcher,
  isAccessibleRoutePath,
  isKnownAccessRoutePath,
  isPublicRoutePath,
  normalizeAdminPath,
  resolveAdminAccessGuard,
  resolveLoginRedirect,
  resolvePostLoginPath,
} from '@monorepo-admin-core/access-effect'
export type { ResolvedAdminAccess } from '@monorepo-admin-core/access-effect'
export { registerAdminAccessRoutes, resetAdminAccessRoutes } from './register'

const forbiddenComponent = () => import('@/pages/403.vue')
const iframeComponent = { name: 'IFrameView', render: () => null }
const externalLinkComponent = { name: 'ExternalLinkView', render: () => null }

export function resolveAdminAccess(accessFileRoutes: readonly RouteRecordRaw[], backendMenus: readonly AdminBackendMenu[], roles: readonly string[]) {
  return resolveAdminAccessBase(accessFileRoutes, backendMenus, roles, { externalLinkComponent, forbiddenComponent, iframeComponent })
}
