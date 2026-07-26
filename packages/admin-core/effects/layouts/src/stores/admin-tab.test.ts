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
