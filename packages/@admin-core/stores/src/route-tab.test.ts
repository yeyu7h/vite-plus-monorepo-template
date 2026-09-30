import { expect, test } from 'vite-plus/test'
import { platform } from '@monorepo/shared/utils'
import { closeAdminTab, createAdminTab, createAdminTabRecord, markActiveAdminTabs, upsertAdminTab } from './route-tab'

test('creates a route tab from the current route', () => {
  const tab = createAdminTab({
    meta: { icon: 'i-lucide-layout-dashboard', showActiveTabBorder: true, title: '工作台' },
    path: '/dashboard/workbench',
  })

  expect(tab).toEqual({
    icon: 'i-lucide-layout-dashboard',
    key: '/dashboard/workbench',
    showActiveTabBorder: true,
    title: '工作台',
    to: '/dashboard/workbench',
  })
})

test('explicitly closes pinned tabs while respecting non-closable tabs', () => {
  const tabs = [
    { key: '/home', title: 'Home', to: '/home', pinned: true },
    { key: '/reports', title: 'Reports', to: '/reports' },
  ]
  expect(closeAdminTab(tabs, '/home', '/home')).toEqual({ nextActiveTarget: '/reports', tabs: [tabs[1]] })
  expect(closeAdminTab([{ ...tabs[0]!, closable: false }, tabs[1]!], '/home', '/home').tabs).toHaveLength(2)
})

test('creates a runtime tab record with an independent view path and keep-alive meta', () => {
  const tab = createAdminTabRecord({
    meta: {
      iframeSrc: ' https://example.com/docs ',
      keepAlive: true,
      tabPath: '/docs',
      title: '文档详情',
    },
    path: '/docs/detail?section=api#request',
    tabPath: '/docs',
  })

  expect(tab).toEqual({
    iframeSrc: 'https://example.com/docs',
    keepAlive: true,
    key: '/docs',
    meta: {
      iframeSrc: ' https://example.com/docs ',
      keepAlive: true,
      tabPath: '/docs',
      title: '文档详情',
    },
    showActiveTabBorder: void 0,
    title: '文档详情',
    to: '/docs',
    viewPath: '/docs/detail?section=api#request',
  })
})

test('disables keep-alive for runtime tab records on mobile', () => {
  const originalMobile = platform.is.mobile
  platform.is.mobile = true

  try {
    const tab = createAdminTabRecord({
      meta: {
        keepAlive: true,
        title: '移动端页面',
      },
      path: '/mobile-page',
    })

    expect(tab?.keepAlive).toBe(false)
  } finally {
    platform.is.mobile = originalMobile
  }
})

test('skips tab creation when hideInTab is set', () => {
  const tab = createAdminTab({
    meta: {
      activePath: '/system/settings',
      hideInTab: true,
      title: '通知设置',
    },
    path: '/system/settings/notification',
    tabPath: '/system/settings',
  })

  expect(tab).toBeUndefined()
})

test('reuses explicit canonical tabPath independently from activePath', () => {
  const tab = createAdminTab(
    {
      meta: {
        activePath: '/fallback/settings',
        title: '通知设置',
      },
      path: '/system/settings/notification',
      tabPath: '/system/settings',
    },
    {
      resolveRoute: (path) => ({
        meta: {
          icon: 'i-lucide-sliders-horizontal',
          title: '系统设置',
        },
        path,
      }),
    },
  )

  expect(tab).toEqual({
    icon: 'i-lucide-sliders-horizontal',
    key: '/system/settings',
    showActiveTabBorder: void 0,
    title: '系统设置',
    to: '/system/settings',
  })
})

test('does not reuse activePath when tabPath is not set', () => {
  const tab = createAdminTab({
    meta: {
      activePath: '/system/settings',
      title: '通知设置',
    },
    path: '/system/settings/notification',
  })

  expect(tab).toEqual({
    icon: void 0,
    key: '/system/settings/notification',
    showActiveTabBorder: void 0,
    title: '通知设置',
    to: '/system/settings/notification',
  })
})

test('preserves query and hash in the default tab identity and target', () => {
  const tab = createAdminTab({
    meta: {
      title: '销售报表',
    },
    path: '/reports/sales?range=week#chart',
  })

  expect(tab).toEqual({
    icon: void 0,
    key: '/reports/sales?range=week#chart',
    showActiveTabBorder: void 0,
    title: '销售报表',
    to: '/reports/sales?range=week#chart',
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
        key: '/dashboard/workbench',
        title: '工作台',
        to: '/dashboard/workbench',
      },
    ],
    {
      icon: 'i-lucide-layout-dashboard',
      key: '/dashboard/workbench',
      title: '工作台',
      to: '/dashboard/workbench',
    },
  )

  expect(tabs).toEqual([
    {
      icon: 'i-lucide-layout-dashboard',
      key: '/dashboard/workbench',
      title: '工作台',
      to: '/dashboard/workbench',
    },
  ])
})

test('keeps tabs with different query parameters separate', () => {
  const tabs = upsertAdminTab([{ key: '/reports/sales?range=week', title: '销售报表', to: '/reports/sales?range=week' }], {
    key: '/reports/sales?range=month',
    title: '销售报表',
    to: '/reports/sales?range=month',
  })

  expect(tabs).toHaveLength(2)
})

test('marks only the current route tab active', () => {
  const tabs = markActiveAdminTabs(
    [
      { key: '/dashboard/workbench', title: '工作台', to: '/dashboard/workbench' },
      { key: '/system/settings', title: '系统设置', to: '/system/settings' },
    ],
    '/system/settings',
  )

  expect(tabs).toEqual([
    { active: false, key: '/dashboard/workbench', title: '工作台', to: '/dashboard/workbench' },
    { active: true, key: '/system/settings', title: '系统设置', to: '/system/settings' },
  ])
})

test('closes the active tab and prefers the next tab on the right', () => {
  const result = closeAdminTab(
    [
      { key: '/dashboard/workbench', title: '工作台', to: '/dashboard/workbench' },
      { key: '/system/settings', title: '系统设置', to: '/system/settings?section=general' },
      { key: '/reports/sales', title: '销售报表', to: '/reports/sales?range=week#chart' },
    ],
    '/system/settings',
    '/system/settings',
  )

  expect(result).toEqual({
    nextActiveTarget: '/reports/sales?range=week#chart',
    tabs: [
      { key: '/dashboard/workbench', title: '工作台', to: '/dashboard/workbench' },
      { key: '/reports/sales', title: '销售报表', to: '/reports/sales?range=week#chart' },
    ],
  })
})

test('does not close the final remaining tab', () => {
  const result = closeAdminTab([{ key: '/dashboard/workbench', title: '工作台', to: '/dashboard/workbench' }], '/dashboard/workbench', '/dashboard/workbench')

  expect(result).toEqual({
    tabs: [{ key: '/dashboard/workbench', title: '工作台', to: '/dashboard/workbench' }],
  })
})

test('reuses pageKey across different ids while retaining the current address and title', () => {
  const first = createAdminTabRecord({ name: 'Detail', path: '/users/1', fullPath: '/users/1?pageKey=user-detail', query: { pageKey: 'user-detail' }, meta: { title: 'User 1' } })!
  const second = createAdminTabRecord({ name: 'Detail', path: '/users/2', fullPath: '/users/2?pageKey=user-detail', query: { pageKey: 'user-detail' }, meta: { title: 'User 2' } })!
  const tabs = upsertAdminTab([first], second)
  expect(tabs).toHaveLength(1)
  expect(tabs[0]).toMatchObject({ key: 'user-detail', title: 'User 2', to: '/users/2?pageKey=user-detail', viewPath: '/users/2?pageKey=user-detail', routeName: 'Detail' })
})

test('fullPathKey false ignores query and hash but still separates different ids', () => {
  const record = (path: string) => createAdminTabRecord({ path, meta: { title: 'Detail', fullPathKey: false } })!
  const tabs = upsertAdminTab([record('/users/1?a=1#top')], record('/users/1?a=2#bottom'))
  expect(tabs).toHaveLength(1)
  expect(tabs[0]).toMatchObject({ key: '/users/1', to: '/users/1?a=2#bottom' })
  expect(upsertAdminTab(tabs, record('/users/2'))).toHaveLength(2)
})

test.each([
  ['first', ['first', 'second']],
  ['/details', '%2Fdetails'],
  ['%invalid', '%invalid'],
  ['/users/1', ''],
])('resolves pageKey to %s safely', (key, pageKey) => {
  expect(createAdminTab({ path: '/users/1', query: { pageKey }, meta: { title: 'Detail', fullPathKey: false } })?.key).toBe(key)
})

test('explicit key options take precedence over legacy tabPath without inheriting the list title', () => {
  const route = { path: '/users/1', fullPath: '/users/1?pageKey=detail', query: { pageKey: 'detail' }, tabPath: '/users', meta: { title: 'Detail', fullPathKey: false } }
  expect(createAdminTab(route, { resolveRoute: () => ({ path: '/users', meta: { title: 'List' } }) })).toMatchObject({ key: 'detail', title: 'Detail', to: '/users/1?pageKey=detail' })
})
