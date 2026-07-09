import { expect, test } from 'vite-plus/test'
import { closeAdminTab, createAdminTab, markActiveAdminTabs, upsertAdminTab } from './route-tab'

test('creates a route tab from the current route', () => {
  const tab = createAdminTab({
    meta: { icon: 'i-lucide-layout-dashboard', showActiveTabBorder: true, title: '工作台' },
    path: '/dashboard/workbench',
  })

  expect(tab).toEqual({
    closable: undefined,
    icon: 'i-lucide-layout-dashboard',
    path: '/dashboard/workbench',
    showActiveTabBorder: true,
    title: '工作台',
  })
})

test('reuses parent tab metadata when hideInTab and activePath are set', () => {
  const tab = createAdminTab(
    {
      meta: {
        activePath: '/system/settings',
        hideInTab: true,
        title: '通知设置',
      },
      path: '/system/settings/notification',
    },
    {
      resolveRoute: (path) => ({
        meta: {
          icon: 'i-lucide-settings',
          showActiveTabBorder: true,
          title: '系统设置',
        },
        path,
      }),
    },
  )

  expect(tab).toEqual({
    icon: 'i-lucide-settings',
    path: '/system/settings',
    showActiveTabBorder: true,
    title: '系统设置',
  })
})

test('skips tab creation for external links', () => {
  const tab = createAdminTab({
    meta: {
      externalLink: 'https://viteplus.dev/guide/',
      title: 'Vite+ Docs',
    },
    path: '/docs/vite-plus',
  })

  expect(tab).toBeUndefined()
})

test('upserts route tabs without duplicating the same path', () => {
  const tabs = upsertAdminTab(
    [
      {
        path: '/dashboard/workbench',
        title: '工作台',
      },
    ],
    {
      icon: 'i-lucide-layout-dashboard',
      path: '/dashboard/workbench',
      title: '工作台',
    },
  )

  expect(tabs).toEqual([
    {
      icon: 'i-lucide-layout-dashboard',
      path: '/dashboard/workbench',
      title: '工作台',
    },
  ])
})

test('marks only the current route tab active', () => {
  const tabs = markActiveAdminTabs(
    [
      { path: '/dashboard/workbench', title: '工作台' },
      { path: '/system/settings', title: '系统设置' },
    ],
    '/system/settings',
  )

  expect(tabs).toEqual([
    { active: false, path: '/dashboard/workbench', title: '工作台' },
    { active: true, path: '/system/settings', title: '系统设置' },
  ])
})

test('closes the active tab and prefers the next tab on the right', () => {
  const result = closeAdminTab(
    [
      { path: '/dashboard/workbench', title: '工作台' },
      { path: '/system/settings', title: '系统设置' },
      { path: '/reports/sales', title: '销售报表' },
    ],
    '/system/settings',
    '/system/settings',
  )

  expect(result).toEqual({
    nextActivePath: '/reports/sales',
    tabs: [
      { path: '/dashboard/workbench', title: '工作台' },
      { path: '/reports/sales', title: '销售报表' },
    ],
  })
})

test('does not close the final remaining tab', () => {
  const result = closeAdminTab([{ path: '/dashboard/workbench', title: '工作台' }], '/dashboard/workbench', '/dashboard/workbench')

  expect(result).toEqual({
    tabs: [{ path: '/dashboard/workbench', title: '工作台' }],
  })
})
