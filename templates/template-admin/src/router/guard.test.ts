import type { AdminAccessGuardOptions, AdminAccessGuardState } from '@monorepo-admin-core/access-effect'
import type { RouteLocationNormalized, RouteLocationRaw, RouteLocationResolved, RouteRecordRaw, Router } from 'vue-router'
import { expect, test, vi } from 'vite-plus/test'
import { createRouterGuard } from './guard'

type RegisteredGuard = (to: RouteLocationNormalized) => Promise<RouteLocationRaw | true>

const mocks = vi.hoisted(() => ({
  accessState: {} as AdminAccessGuardState,
  createAdminRoutePathMatcher: vi.fn<(routes: readonly RouteRecordRaw[]) => (path: string) => boolean>(),
  resolveAdminAccessGuard: vi.fn<(to: RouteLocationNormalized, accessState: AdminAccessGuardState, options: AdminAccessGuardOptions) => Promise<RouteLocationRaw | true>>(),
  routerResolve: vi.fn<(fullPath: string) => RouteLocationResolved>(),
  useAdminAuthStore: vi.fn<() => AdminAccessGuardState>(),
}))

vi.mock('@monorepo-admin-core/access-effect', () => ({
  createAdminRoutePathMatcher: mocks.createAdminRoutePathMatcher,
  resolveAdminAccessGuard: mocks.resolveAdminAccessGuard,
}))

vi.mock('@/stores/auth', () => ({
  useAdminAuthStore: mocks.useAdminAuthStore,
}))

test('registers one access guard and reuses its route matcher', async () => {
  const accessRoutes: RouteRecordRaw[] = [{ component: {}, path: '/system/role' }]
  const matchesAccessPath = vi.fn<(path: string) => boolean>()
  const guardResult = { path: '/403', replace: true }
  let registeredGuard: RegisteredGuard | undefined
  const beforeEach = vi.fn<(guard: RegisteredGuard) => () => void>((guard) => {
    registeredGuard = guard
    return () => {}
  })
  const router = {
    beforeEach,
    resolve: mocks.routerResolve,
  } as unknown as Router

  mocks.createAdminRoutePathMatcher.mockReturnValue(matchesAccessPath)
  mocks.resolveAdminAccessGuard.mockResolvedValue(guardResult)
  mocks.useAdminAuthStore.mockReturnValue(mocks.accessState)

  createRouterGuard(router, accessRoutes)

  expect(beforeEach).toHaveBeenCalledOnce()
  expect(mocks.createAdminRoutePathMatcher).toHaveBeenCalledExactlyOnceWith(accessRoutes)

  const to = createRoute('/system/role')
  await expect(registeredGuard?.(to)).resolves.toBe(guardResult)

  expect(mocks.useAdminAuthStore).toHaveBeenCalledOnce()
  expect(mocks.resolveAdminAccessGuard).toHaveBeenCalledExactlyOnceWith(to, mocks.accessState, {
    matchesAccessPath,
    resolveRoute: expect.any(Function),
  })
  expect(mocks.createAdminRoutePathMatcher).toHaveBeenCalledOnce()
})

test('provides a route resolver that preserves path query and hash', async () => {
  let registeredGuard: RegisteredGuard | undefined
  const router = {
    beforeEach: (guard: RegisteredGuard) => {
      registeredGuard = guard
      return () => {}
    },
    resolve: mocks.routerResolve,
  } as unknown as Router
  const resolvedRoute = {
    hash: '#permissions',
    path: '/system/role',
    query: { tab: 'users' },
  } as unknown as RouteLocationResolved

  mocks.createAdminRoutePathMatcher.mockReturnValue(() => true)
  mocks.routerResolve.mockReturnValue(resolvedRoute)
  mocks.useAdminAuthStore.mockReturnValue(mocks.accessState)
  mocks.resolveAdminAccessGuard.mockImplementation(async (to, _accessState, options) => options.resolveRoute(to.fullPath))

  createRouterGuard(router, [])

  await expect(registeredGuard?.(createRoute('/system/role?tab=users#permissions'))).resolves.toEqual({
    hash: '#permissions',
    path: '/system/role',
    query: { tab: 'users' },
  })
  expect(mocks.routerResolve).toHaveBeenCalledExactlyOnceWith('/system/role?tab=users#permissions')
})

function createRoute(fullPath: string): RouteLocationNormalized {
  return {
    fullPath,
    path: fullPath.split(/[?#]/)[0] ?? '/',
  } as RouteLocationNormalized
}
