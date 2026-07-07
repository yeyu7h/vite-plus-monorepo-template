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
  const prefix = buildAdminBreadcrumbPrefix({ path: '/system/role', meta: { title: '角色管理', menuGroup: '系统管理' } })

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
      menuGroup: {
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
