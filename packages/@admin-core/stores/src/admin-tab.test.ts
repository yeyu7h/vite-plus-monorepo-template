// @vitest-environment happy-dom

import type { AdminTabRecord } from '@monorepo-admin-core/types'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, expect, test } from 'vite-plus/test'
import { useAdminTabStore } from './admin-tab'

const STORAGE_KEY = 'test:admin-tabs'

beforeEach(() => {
  sessionStorage.clear()
  setActivePinia(createPinia())
})

test('stores, deduplicates and marks route tabs active', () => {
  const store = useAdminTabStore()
  store.initialize(STORAGE_KEY, [createRecord('/dashboard')])
  store.upsert(createRecord('/reports'))
  store.upsert({ ...createRecord('/reports'), title: '最新报表' })
  store.setActive('/reports')

  expect(store.records).toHaveLength(2)
  expect(store.activeRecord?.title).toBe('最新报表')
  expect(store.tabs.map(({ active, key }) => ({ active, key }))).toEqual([
    { active: false, key: '/dashboard' },
    { active: true, key: '/reports' },
  ])
})

test('treats the only tab as fixed and refuses to unpin it', () => {
  const store = useAdminTabStore()
  store.initialize(STORAGE_KEY, [])
  store.upsert(createRecord('/home'))

  expect(store.tabs[0]?.pinned).toBe(true)
  expect(store.close('/home')).toBeUndefined()
  store.setPinned('/home', false)
  expect(store.tabs[0]?.pinned).toBe(true)

  store.upsert(createRecord('/reports'))
  expect(store.tabs.find((tab) => tab.key === '/home')?.pinned).toBeUndefined()

  store.close('/reports')
  expect(store.tabs[0]).toMatchObject({ key: '/home', pinned: true })
})

test('persists a versioned minimal snapshot and restores it through the public reader', () => {
  const store = useAdminTabStore()
  store.initialize(STORAGE_KEY, [])
  store.upsert(createRecord('/dashboard?mode=compact'))

  expect(JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '')).toEqual({
    tabs: [
      {
        to: '/dashboard?mode=compact',
        viewPath: '/dashboard?mode=compact',
      },
    ],
    version: 1,
  })

  setActivePinia(createPinia())
  expect(useAdminTabStore().readPersistedTabs(STORAGE_KEY)).toEqual([
    {
      to: '/dashboard?mode=compact',
      viewPath: '/dashboard?mode=compact',
    },
  ])
})

test('drops invalid persisted data and resets memory and storage', () => {
  sessionStorage.setItem(STORAGE_KEY, '{"version":0,"tabs":[]}')

  const store = useAdminTabStore()
  expect(store.readPersistedTabs(STORAGE_KEY)).toEqual([])
  expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull()

  store.initialize(STORAGE_KEY, [createRecord('/dashboard')])
  store.setActive('/dashboard')
  store.reset()

  expect(store.records).toEqual([])
  expect(store.activeKey).toBe('')
  expect(store.initialized).toBe(false)
  expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull()
})

test('clears an explicit application storage key before the layout store is initialized', () => {
  const applicationStorageKey = 'template-admin:open-tabs'
  sessionStorage.setItem(applicationStorageKey, '{"version":1,"tabs":[]}')

  const store = useAdminTabStore()
  store.reset({ storageKey: applicationStorageKey })

  expect(sessionStorage.getItem(applicationStorageKey)).toBeNull()
})

test('closes the active tab and returns the adjacent navigation target', () => {
  const store = useAdminTabStore()
  store.initialize(STORAGE_KEY, [createRecord('/dashboard'), createRecord('/reports'), createRecord('/system')])
  store.setActive('/reports')

  expect(store.close('/reports')).toBe('/system')
  expect(store.records.map((item) => item.key)).toEqual(['/dashboard', '/system'])
})

test('closes other tabs atomically, retaining pinned and non-closable tabs and clearing cache state', () => {
  const store = useAdminTabStore()
  store.initialize(STORAGE_KEY, [createRecord('/pinned', { pinned: true }), createRecord('/home', { keepAlive: true }), createRecord('/reports'), createRecord('/locked', { closable: false })])
  store.setActive('/home')
  store.refresh('/home')
  store.setScrollPositions('/home', { body: { left: 0, top: 120 } })

  expect(store.closeOthers('/reports')).toBe('/reports')
  expect(store.records.map((item) => item.key)).toEqual(['/pinned', '/reports', '/locked'])
  expect(store.activeKey).toBe('/reports')
  expect(store.hasRendered('/home')).toBe(false)
  expect(store.getRenderKey('/home')).toBe('/home:0')
  expect(store.getScrollPositions('/home')).toEqual({})
  expect(store.readPersistedTabs(STORAGE_KEY).map((item) => item.viewPath)).toEqual(['/pinned', '/reports', '/locked'])
})

test('closes only closable tabs to the right and leaves the active tab in place when retained', () => {
  const store = useAdminTabStore()
  store.initialize(STORAGE_KEY, [createRecord('/pinned', { pinned: true }), createRecord('/home'), createRecord('/locked', { closable: false }), createRecord('/reports')])
  store.setActive('/home')

  expect(store.closeToRight('/home')).toBeUndefined()
  expect(store.records.map((item) => item.key)).toEqual(['/pinned', '/home', '/locked'])
  expect(store.activeKey).toBe('/home')
  expect(store.closeToRight('/missing')).toBeUndefined()
  expect(store.closeOthers('/missing')).toBeUndefined()
})

test('pins tabs before ordinary tabs and persists the choice', () => {
  const store = useAdminTabStore()
  store.initialize(STORAGE_KEY, [createRecord('/home'), createRecord('/reports'), createRecord('/settings')])
  store.setActive('/reports')

  store.setPinned('/reports', true)
  expect(store.records.map(({ key }) => key)).toEqual(['/reports', '/home', '/settings'])
  expect(store.activeKey).toBe('/reports')
  expect(store.records).toHaveLength(3)
  expect(store.readPersistedTabs(STORAGE_KEY)[0]).toEqual({ pinned: true, to: '/reports', viewPath: '/reports' })

  store.upsert({ ...createRecord('/reports'), title: 'Updated' })
  expect(store.records[0]).toMatchObject({ key: '/reports', pinned: true, title: 'Updated' })

  store.setPinned('/reports', false)
  expect(store.records[0]?.pinned).toBe(false)
  expect(store.readPersistedTabs(STORAGE_KEY)[0]).toEqual({ to: '/reports', viewPath: '/reports' })
  expect(store.close('/reports')).toBe('/home')
})

test('explicitly closes an active pinned tab and clears its cached state', () => {
  const store = useAdminTabStore()
  store.initialize(STORAGE_KEY, [createRecord('/pinned', { pinned: true, keepAlive: true }), createRecord('/home')])
  store.setActive('/pinned')
  store.refresh('/pinned')
  store.setScrollPositions('/pinned', { body: { left: 0, top: 120 } })

  expect(store.close('/pinned')).toBe('/home')
  expect(store.records.map((item) => item.key)).toEqual(['/home'])
  expect(store.activeKey).toBe('/home')
  expect(store.hasRendered('/pinned')).toBe(false)
  expect(store.getRenderKey('/pinned')).toBe('/pinned:0')
  expect(store.getScrollPositions('/pinned')).toEqual({})
  expect(store.readPersistedTabs(STORAGE_KEY).map((item) => item.viewPath)).toEqual(['/home'])
})

test('reorders pinned and ordinary tabs within their groups and restores the manual order', () => {
  const store = useAdminTabStore()
  store.initialize(STORAGE_KEY, [createRecord('/pinned-1', { pinned: true }), createRecord('/pinned-2', { pinned: true }), createRecord('/home'), createRecord('/reports')])
  store.setActive('/reports')

  store.moveTab('/pinned-2', '/pinned-1', 'before')
  store.moveTab('/reports', '/home', 'before')
  expect(store.records.map(({ key }) => key)).toEqual(['/pinned-2', '/pinned-1', '/reports', '/home'])
  expect(store.activeKey).toBe('/reports')

  const snapshots = store.readPersistedTabs(STORAGE_KEY)
  setActivePinia(createPinia())
  const restored = useAdminTabStore()
  restored.initialize(
    STORAGE_KEY,
    snapshots.map((snapshot) => ({ ...createRecord(snapshot.to), pinned: snapshot.pinned })),
  )
  expect(restored.records.map(({ key }) => key)).toEqual(['/pinned-2', '/pinned-1', '/reports', '/home'])
})

test('rejects dragging across the pinned boundary and preserves the original order', () => {
  const store = useAdminTabStore()
  store.initialize(STORAGE_KEY, [createRecord('/pinned', { pinned: true }), createRecord('/home'), createRecord('/reports')])
  const originalSnapshot = sessionStorage.getItem(STORAGE_KEY)

  store.moveTab('/reports', '/pinned', 'before')
  store.moveTab('/pinned', '/home', 'after')
  expect(store.records.map(({ key, pinned }) => ({ key, pinned: Boolean(pinned) }))).toEqual([
    { key: '/pinned', pinned: true },
    { key: '/home', pinned: false },
    { key: '/reports', pinned: false },
  ])
  expect(sessionStorage.getItem(STORAGE_KEY)).toBe(originalSnapshot)

  store.moveTab('/missing', '/home', 'before')
  store.moveTab('/home', '/missing', 'after')
  store.moveTab('/home', '/home', 'before')
  expect(store.records.map(({ key }) => key)).toEqual(['/pinned', '/home', '/reports'])
})

test('keeps pinned tabs when the route tab limit evicts an older sibling', () => {
  const store = useAdminTabStore()
  const detail = (id: number) => ({ ...createRecord(`/users/${id}`), routeName: 'Detail', meta: { title: 'Detail', maxNumOfOpenTab: 2 } })
  store.initialize(STORAGE_KEY, [detail(1), detail(2)])
  store.setPinned('/users/1', true)
  store.upsert(detail(3))

  expect(store.records.map(({ key }) => key)).toEqual(['/users/1', '/users/3'])
})

test('returns the adjacent tab last view path when closing an active canonical tab', () => {
  const store = useAdminTabStore()
  const settingsTab = {
    ...createRecord('/system/settings'),
    viewPath: '/system/settings/theme?mode=dark',
  }
  store.initialize(STORAGE_KEY, [createRecord('/dashboard'), settingsTab])
  store.setActive('/dashboard')

  expect(store.close('/dashboard')).toBe('/system/settings/theme?mode=dark')
  expect(store.activeKey).toBe('/system/settings')
})

test('derives keep-alive page and iframe cache pools', () => {
  const store = useAdminTabStore()
  store.initialize(STORAGE_KEY, [createRecord('/dashboard', { keepAlive: true }), createRecord('/reports'), createRecord('/docs', { iframeSrc: 'https://example.com', keepAlive: true })])

  expect(store.keepAlivePageTabs.map((item) => item.key)).toEqual(['/dashboard'])
  expect(store.iframeTabs.map((item) => item.key)).toEqual(['/docs'])
})

test('tracks rendered tabs only in memory and refreshes one render key at a time', () => {
  const store = useAdminTabStore()
  store.initialize(STORAGE_KEY, [createRecord('/dashboard'), createRecord('/docs', { iframeSrc: 'https://example.com', keepAlive: true })])

  expect(store.hasRendered('/docs')).toBe(false)
  expect(store.getRenderKey('/docs')).toBe('/docs:0')

  store.setActive('/docs')
  store.refresh('/docs')

  expect(store.hasRendered('/docs')).toBe(true)
  expect(store.getRenderKey('/docs')).toBe('/docs:1')
  expect(store.getRenderKey('/dashboard')).toBe('/dashboard:0')

  store.close('/docs')
  expect(store.hasRendered('/docs')).toBe(false)
  expect(store.getRenderKey('/docs')).toBe('/docs:0')
})

test('keeps scroll positions only for cached tabs and clears them on refresh and close', () => {
  const store = useAdminTabStore()
  store.initialize(STORAGE_KEY, [createRecord('/dashboard', { keepAlive: true }), createRecord('/reports')])

  store.setScrollPositions('/dashboard', {
    main: { left: 12, top: 240 },
    table: { left: 0, top: 480 },
  })
  store.setScrollPositions('/reports', { main: { left: 0, top: 80 } })

  expect(store.getScrollPositions('/dashboard')).toEqual({
    main: { left: 12, top: 240 },
    table: { left: 0, top: 480 },
  })
  expect(store.getScrollPositions('/reports')).toEqual({})

  store.refresh('/dashboard')
  expect(store.getScrollPositions('/dashboard')).toEqual({})

  store.setScrollPositions('/dashboard', { main: { left: 0, top: 120 } })
  store.close('/dashboard')
  expect(store.getScrollPositions('/dashboard')).toEqual({})
})

test('keeps the final tab render state when close is rejected', () => {
  const store = useAdminTabStore()
  store.initialize(STORAGE_KEY, [createRecord('/docs', { iframeSrc: 'https://example.com', keepAlive: true })])
  store.setActive('/docs')
  store.refresh('/docs')

  expect(store.close('/docs')).toBeUndefined()
  expect(store.records).toHaveLength(1)
  expect(store.hasRendered('/docs')).toBe(true)
  expect(store.getRenderKey('/docs')).toBe('/docs:1')
})

/** 创建测试用的 `AdminTabRecord` */
function createRecord(path: string, options: Partial<AdminTabRecord> = {}): AdminTabRecord {
  return {
    keepAlive: false,
    key: path,
    meta: { title: path },
    title: path,
    to: path,
    viewPath: path,
    ...options,
  }
}

test('evicts the earliest tab of the same route name and clears its cached state', () => {
  const store = useAdminTabStore()
  const detail = (id: number) => ({ ...createRecord(`/users/${id}`), routeName: 'UserDetail', keepAlive: true, meta: { title: 'User', maxNumOfOpenTab: 2 } })
  store.initialize(STORAGE_KEY, [createRecord('/home'), detail(1), detail(2)])
  store.setActive('/users/1')
  store.refresh('/users/1')
  store.setScrollPositions('/users/1', { content: { top: 100, left: 0 } })
  store.upsert(detail(3))
  expect(store.records.map(({ key }) => key)).toEqual(['/home', '/users/2', '/users/3'])
  expect(store.activeKey).toBe('/users/3')
  expect(store.hasRendered('/users/1')).toBe(false)
  expect(store.refreshVersions['/users/1']).toBeUndefined()
  expect(store.getScrollPositions('/users/1')).toEqual({})
  expect(store.readPersistedTabs(STORAGE_KEY).map(({ viewPath }) => viewPath)).toEqual(['/home', '/users/2', '/users/3'])
})

test('updating a shared key does not evict tabs even when its route limit is reached', () => {
  const store = useAdminTabStore()
  const shared = { ...createRecord('/detail'), routeName: 'Detail', meta: { title: 'Detail', maxNumOfOpenTab: 1 } }
  store.initialize(STORAGE_KEY, [shared, createRecord('/home')])
  store.upsert({ ...shared, viewPath: '/users/2?pageKey=detail' })
  expect(store.records).toHaveLength(2)
  expect(store.records[0]?.viewPath).toBe('/users/2?pageKey=detail')
})

test('applies per-route limits when restoring tabs', () => {
  const store = useAdminTabStore()
  store.initialize(
    STORAGE_KEY,
    [1, 2, 3].map((id) => ({ ...createRecord(`/users/${id}`), routeName: 'Detail', meta: { title: 'Detail', maxNumOfOpenTab: 1 } })),
  )
  expect(store.records.map(({ key }) => key)).toEqual(['/users/3'])
})

test.each(['__proto__', 'constructor'])('handles arbitrary shared pageKey %s in cache state', (key) => {
  const store = useAdminTabStore()
  store.initialize(STORAGE_KEY, [{ ...createRecord('/users/1'), key, keepAlive: true }])
  expect(store.getRenderKey(key)).toBe(`${key}:0`)
  expect(store.getScrollPositions(key)).toEqual({})
  store.refresh(key)
  expect(store.getRenderKey(key)).toBe(`${key}:1`)
  store.setScrollPositions(key, { body: { top: 20, left: 0 } })
  expect(store.getScrollPositions(key)).toEqual({ body: { top: 20, left: 0 } })
})

test('replacing a shared key clears the previous page iframe and route identity', () => {
  const store = useAdminTabStore()
  store.initialize(STORAGE_KEY, [{ ...createRecord('/frame'), key: 'shared', iframeSrc: 'https://example.com', routeName: 'Frame' }])
  store.upsert({ ...createRecord('/page'), key: 'shared' })
  expect(store.records).toHaveLength(1)
  expect(store.activeRecord).toBeUndefined()
  expect(store.records[0]?.iframeSrc).toBeUndefined()
  expect(store.records[0]?.routeName).toBeUndefined()
  expect(store.records[0]?.viewPath).toBe('/page')
})
