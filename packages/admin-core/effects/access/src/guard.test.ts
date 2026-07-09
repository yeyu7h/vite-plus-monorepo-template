import type { RouteLocationNormalized } from 'vue-router'
import { expect, test, vi } from 'vite-plus/test'
import type { AdminAccessGuardState } from './guard'
import { DEFAULT_ADMIN_HOME_PATH, FORBIDDEN_ROUTE_PATH, LOGIN_ROUTE_PATH, resolveAdminAccessGuard, resolveLoginRedirect, resolvePostLoginPath } from './guard'

test('creates login redirect for protected local targets only', () => {
  expect(resolveLoginRedirect('/system/role?tab=users#top')).toBe(encodeURIComponent('/system/role?tab=users#top'))
  expect(resolveLoginRedirect(DEFAULT_ADMIN_HOME_PATH)).toBe(void 0)
  expect(resolveLoginRedirect(LOGIN_ROUTE_PATH)).toBe(void 0)
  expect(resolveLoginRedirect('/403')).toBe(void 0)
})

test('keeps accessible post-login redirect with query and hash', () => {
  const redirect = encodeURIComponent('/reports/sales?range=week#chart')

  expect(
    resolvePostLoginPath(redirect, {
      canAccessPath: (path) => path === '/reports/sales',
      fallbackPath: DEFAULT_ADMIN_HOME_PATH,
    }),
  ).toBe('/reports/sales?range=week#chart')
})

test('falls back when post-login redirect is unsafe public empty invalid or unauthorized', () => {
  const redirects = [
    '',
    'https://example.com/system/role',
    '//example.com/system/role',
    '%E0%A4%A',
    encodeURIComponent(LOGIN_ROUTE_PATH),
    encodeURIComponent('/403'),
    encodeURIComponent('/system/role'),
  ]

  for (const redirect of redirects) {
    expect(
      resolvePostLoginPath(redirect, {
        canAccessPath: (path) => path === DEFAULT_ADMIN_HOME_PATH,
        fallbackPath: DEFAULT_ADMIN_HOME_PATH,
      }),
    ).toBe(DEFAULT_ADMIN_HOME_PATH)
  }
})

test('redirects anonymous protected access to login with encoded redirect', async () => {
  const result = await resolveAdminAccessGuard(createRoute('/system/role?tab=users#top'), createAccessState(), {
    accessRoutePathSet: new Set(['/system/role']),
    resolveRoute,
  })

  expect(result).toEqual({
    path: LOGIN_ROUTE_PATH,
    query: { redirect: encodeURIComponent('/system/role?tab=users#top') },
    replace: true,
  })
})

test('redirects logged-in user to forbidden when target exists but is not accessible', async () => {
  const result = await resolveAdminAccessGuard(
    createRoute('/system/role'),
    createAccessState({
      isLoggedIn: true,
      restoreAccess: vi.fn<() => Promise<boolean>>(async () => false),
    }),
    {
      accessRoutePathSet: new Set(['/system/role']),
      resolveRoute,
    },
  )

  expect(result).toEqual({
    path: FORBIDDEN_ROUTE_PATH,
    replace: true,
  })
})

test('allows unknown logged-in targets to fall through to fallback routes', async () => {
  const result = await resolveAdminAccessGuard(
    createRoute('/not-exists'),
    createAccessState({
      isLoggedIn: true,
      restoreAccess: vi.fn<() => Promise<boolean>>(async () => false),
    }),
    {
      accessRoutePathSet: new Set(['/system/role']),
      resolveRoute,
    },
  )

  expect(result).toBe(true)
})

test('re-resolves target after dynamic access routes are restored', async () => {
  const result = await resolveAdminAccessGuard(
    createRoute('/system/role?tab=users'),
    createAccessState({
      canAccessPath: (path) => path === '/system/role',
      isLoggedIn: true,
      restoreAccess: vi.fn<() => Promise<boolean>>(async () => true),
    }),
    {
      accessRoutePathSet: new Set(['/system/role']),
      resolveRoute,
    },
  )

  expect(result).toEqual({
    hash: '',
    path: '/system/role',
    query: { tab: 'users' },
    replace: true,
  })
})

function createAccessState(overrides: Partial<AdminAccessGuardState> = {}): AdminAccessGuardState {
  return {
    canAccessPath: () => false,
    homePath: DEFAULT_ADMIN_HOME_PATH,
    isLoggedIn: false,
    restoreAccess: vi.fn<() => Promise<boolean>>(async () => false),
    ...overrides,
  }
}

function createRoute(fullPath: string): RouteLocationNormalized {
  return {
    fullPath,
    path: fullPath.split(/[?#]/)[0] ?? '/',
  } as RouteLocationNormalized
}

function resolveRoute(fullPath: string) {
  const [pathWithQuery, hash = ''] = fullPath.split('#')
  const [path, queryString = ''] = (pathWithQuery ?? '/').split('?')
  const query = queryString ? Object.fromEntries(new URLSearchParams(queryString)) : {}

  return {
    hash: hash ? `#${hash}` : '',
    path: path || '/',
    query,
  }
}
