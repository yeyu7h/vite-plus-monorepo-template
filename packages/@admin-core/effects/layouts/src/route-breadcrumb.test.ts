import { expect, test } from 'vite-plus/test'
import { buildAdminBreadcrumbPrefix, buildAdminBreadcrumbs } from './route-breadcrumb'

test('builds breadcrumbs from route path and meta titles', () => {
  const breadcrumbs = buildAdminBreadcrumbs({ path: '/system/role', meta: { title: '角色管理', icon: 'i-lucide-shield-check' } }, [
    { path: '/system', meta: { title: '系统管理', icon: 'i-lucide-settings' } },
  ])

  expect(breadcrumbs).toEqual([
    {
      icon: 'i-lucide-settings',
      path: undefined,
      title: '系统管理',
    },
    {
      icon: 'i-lucide-shield-check',
      path: undefined,
      title: '角色管理',
    },
  ])
})

test('prefers matched parent route meta for breadcrumb names and icons', () => {
  const breadcrumbs = buildAdminBreadcrumbs({
    matched: [
      { path: '/system', meta: { title: '系统管理', icon: 'i-lucide-settings' } },
      { path: '/system/role', meta: { title: '角色管理', icon: 'i-lucide-shield-check' } },
    ],
    path: '/system/role',
    meta: { title: '角色管理', icon: 'i-lucide-shield-check' },
  })

  expect(breadcrumbs).toEqual([
    {
      icon: 'i-lucide-settings',
      path: undefined,
      title: '系统管理',
    },
    {
      icon: 'i-lucide-shield-check',
      path: undefined,
      title: '角色管理',
    },
  ])
})

test('respects canonical hideInBreadcrumb when parent should be hidden', () => {
  const breadcrumbs = buildAdminBreadcrumbs(
    {
      matched: [
        { path: '/system', meta: { title: '系统' } },
        { path: '/system/role', meta: { title: '角色管理', icon: 'i-lucide-shield-check' } },
      ],
      path: '/system/role',
      meta: { title: '角色管理', icon: 'i-lucide-shield-check' },
    },
    [
      { path: '/system', meta: { title: '系统', hideInBreadcrumb: true } },
      { path: '/system/role', meta: { title: '角色管理', icon: 'i-lucide-shield-check' } },
    ],
  )

  expect(breadcrumbs).toEqual([
    {
      icon: 'i-lucide-shield-check',
      path: undefined,
      title: '角色管理',
    },
  ])
})

test('skips placeholder parent routes without title when menu group already covers the section', () => {
  const breadcrumbs = buildAdminBreadcrumbs(
    {
      matched: [
        { path: '/system', meta: {} },
        { path: '/system/role', meta: { title: '角色管理', icon: 'i-lucide-shield-check' } },
      ],
      path: '/system/role',
      meta: {
        title: '角色管理',
        icon: 'i-lucide-shield-check',
        group: '系统管理',
      },
    },
    [
      { path: '/system', meta: {} },
      { path: '/system/role', meta: { title: '角色管理', icon: 'i-lucide-shield-check' } },
    ],
  )

  expect(breadcrumbs).toEqual([
    {
      icon: 'i-lucide-shield-check',
      path: undefined,
      title: '角色管理',
    },
  ])
})

test('does not inherit parent hideInBreadcrumb onto current child route', () => {
  const breadcrumbs = buildAdminBreadcrumbs(
    {
      matched: [
        { path: '/dashboard', meta: { title: '仪表盘', hideInBreadcrumb: true } },
        { path: '/dashboard/workbench', meta: { title: '工作台', icon: 'i-lucide-layout-dashboard' } },
      ],
      path: '/dashboard/workbench',
      meta: {
        title: '工作台',
        icon: 'i-lucide-layout-dashboard',
        hideInBreadcrumb: true,
        group: '概览',
      },
    },
    [
      { path: '/dashboard', meta: { title: '仪表盘', hideInBreadcrumb: true } },
      { path: '/dashboard/workbench', meta: { title: '工作台', icon: 'i-lucide-layout-dashboard' } },
    ],
  )

  expect(breadcrumbs).toEqual([
    {
      icon: 'i-lucide-layout-dashboard',
      path: undefined,
      title: '工作台',
    },
  ])
})

test('deduplicates repeated matched paths from index file routes', () => {
  const breadcrumbs = buildAdminBreadcrumbs({
    matched: [
      { path: '/user', meta: {} },
      { path: '/user/', meta: {} },
      { path: '', meta: { title: '用户' } },
    ],
    path: '/user',
    meta: { title: '用户' },
  })

  expect(breadcrumbs).toEqual([
    {
      icon: undefined,
      path: undefined,
      title: '用户',
    },
  ])
})

test('keeps fallback parents non-clickable when only placeholder route exists', () => {
  const breadcrumbs = buildAdminBreadcrumbs({ path: '/docs/vite-plus', meta: { title: 'Vite+ Docs' } }, [{ path: '/docs', meta: {} }])

  expect(breadcrumbs).toEqual([
    {
      icon: undefined,
      path: undefined,
      title: 'Docs',
    },
    {
      icon: undefined,
      path: undefined,
      title: 'Vite+ Docs',
    },
  ])
})

test('creates non-clickable synthetic parents when no parent route exists', () => {
  const breadcrumbs = buildAdminBreadcrumbs({ path: '/dashboard/workbench', meta: { title: '工作台' } })

  expect(breadcrumbs).toEqual([
    {
      icon: undefined,
      path: undefined,
      title: 'Dashboard',
    },
    {
      icon: undefined,
      path: undefined,
      title: '工作台',
    },
  ])
})

test('respects hideInBreadcrumb meta', () => {
  const breadcrumbs = buildAdminBreadcrumbs({ path: '/internal/audit', meta: { title: '审计日志', hideInBreadcrumb: true } })

  expect(breadcrumbs).toEqual([
    {
      icon: undefined,
      path: undefined,
      title: 'Internal',
    },
  ])
})

test('keeps external links non-clickable in breadcrumbs', () => {
  const breadcrumbs = buildAdminBreadcrumbs({ path: '/docs/vite-plus', meta: { title: 'Vite+ Docs' } }, [{ path: '/docs', meta: { title: '文档', externalLink: 'https://viteplus.dev/guide/' } }])

  expect(breadcrumbs[0]).toMatchObject({
    path: undefined,
    title: '文档',
  })
  expect(breadcrumbs[1]?.path).toBeUndefined()
})

test('builds a non-clickable breadcrumb prefix from string menu group', () => {
  const prefix = buildAdminBreadcrumbPrefix({ path: '/system/role', meta: { title: '角色管理', group: '系统管理' } })

  expect(prefix).toEqual([
    {
      title: '系统管理',
    },
  ])
})

test('builds a non-clickable breadcrumb prefix from object menu group', () => {
  const prefix = buildAdminBreadcrumbPrefix({
    path: '/dashboard/workbench',
    meta: {
      title: '工作台',
      group: {
        label: '概览',
        order: 10,
      },
    },
  })

  expect(prefix).toEqual([
    {
      title: '概览',
    },
  ])
})

test('skips breadcrumb prefix when route has no menu group', () => {
  const prefix = buildAdminBreadcrumbPrefix({ path: '/reports/sales', meta: { title: '销售报表' } })

  expect(prefix).toEqual([])
})
