// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { defineComponent, h, nextTick } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, expect, test, vi } from 'vite-plus/test'
import { useAdminTabStore } from '@monorepo-admin-core/stores'
import { useAdminTabbar } from './use-admin-tabbar'

beforeEach(() => sessionStorage.clear())

async function setup(initialPath: string) {
  const pinia = createPinia()
  const component = { render: () => null }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/users/:id', name: 'UserDetail', component, meta: { title: 'User detail', source: 'access', maxNumOfOpenTab: 2 } },
      { path: '/reports', name: 'Reports', component, meta: { title: 'Reports', source: 'access', fullPathKey: false } },
      { path: '/docs', name: 'Docs', component, meta: { title: 'Docs', source: 'access', iframeSrc: 'https://example.com/docs' } },
    ],
  })
  await router.push(initialPath)
  let tabs!: ReturnType<typeof useAdminTabbar>
  const wrapper = mount(
    defineComponent({
      setup() {
        tabs = useAdminTabbar({ storageKey: 'tab-integration' })
        return () => h('div')
      },
    }),
    { global: { plugins: [pinia, router] } },
  )
  return { wrapper, router, tabs, store: useAdminTabStore(pinia) }
}

test('uses actual router names to limit dynamic detail tabs and updates shared keys', async () => {
  const { wrapper, router, store, tabs } = await setup('/users/1')
  try {
    await router.push('/users/2')
    await router.push('/users/3')
    await nextTick()
    expect(store.records.map(({ key }) => key)).toEqual(['/users/2', '/users/3'])
    await router.push('/users/4?pageKey=detail')
    await router.push('/users/5?pageKey=detail')
    await router.push('/reports?range=week')
    await router.push('/reports?range=month#chart')
    await nextTick()
    expect(store.records.map(({ key }) => key)).toEqual(['/users/3', 'detail', '/reports'])
    await tabs.selectTab('detail')
    expect(router.currentRoute.value.fullPath).toBe('/users/5?pageKey=detail')
    await tabs.closeTab('detail')
    expect(router.currentRoute.value.fullPath).toBe('/reports?range=month#chart')
  } finally {
    wrapper.unmount()
  }
})

test('restores shared tabs from their last real URL with the same key', async () => {
  const first = await setup('/users/1?pageKey=detail')
  await first.router.push('/users/2?pageKey=detail')
  await first.router.push('/reports?range=month#chart')
  await nextTick()
  first.wrapper.unmount()
  const restored = await setup('/reports?range=month#chart')
  try {
    expect(restored.store.records.map(({ key }) => key)).toEqual(['detail', '/reports'])
    await restored.tabs.selectTab('detail')
    expect(restored.router.currentRoute.value.fullPath).toBe('/users/2?pageKey=detail')
  } finally {
    restored.wrapper.unmount()
  }
})

test('opens a browser tab at its last real route without switching the current tab', async () => {
  const { wrapper, router, tabs } = await setup('/users/1')
  const open = vi.spyOn(window, 'open').mockImplementation(() => null)
  try {
    await router.push('/reports?range=month#chart')
    tabs.openBrowserTab('/users/1')
    expect(open).toHaveBeenCalledWith('/users/1', '_blank', 'noopener,noreferrer')
    tabs.openBrowserTab('/reports')
    expect(open).toHaveBeenLastCalledWith('/reports?range=month#chart', '_blank', 'noopener,noreferrer')
    expect(router.currentRoute.value.fullPath).toBe('/reports?range=month#chart')

    tabs.openBrowserTab('/missing')
    expect(open).toHaveBeenCalledTimes(2)
  } finally {
    open.mockRestore()
    wrapper.unmount()
  }
})

test('opens an iframe source in a new browser tab without switching the current route', async () => {
  const { wrapper, router, tabs } = await setup('/docs')
  const open = vi.spyOn(window, 'open').mockImplementation(() => null)
  try {
    expect(tabs.tabs.value[0]?.iframeSrc).toBe('https://example.com/docs')
    await router.push('/reports')
    tabs.openBrowserTab('/docs')
    expect(open).toHaveBeenLastCalledWith('/docs', '_blank', 'noopener,noreferrer')
    tabs.openIframeSource('/docs')
    expect(open).toHaveBeenLastCalledWith('https://example.com/docs', '_blank', 'noopener,noreferrer')
    expect(router.currentRoute.value.fullPath).toBe('/reports')

    tabs.openIframeSource('/reports')
    tabs.openIframeSource('/missing')
    expect(open).toHaveBeenCalledTimes(2)
  } finally {
    open.mockRestore()
    wrapper.unmount()
  }
})

test('restores pinned tabs and lets the context menu action unpin them', async () => {
  const first = await setup('/users/1')
  await first.router.push('/reports')
  first.tabs.pinTab('/reports', true)
  first.wrapper.unmount()

  const restored = await setup('/users/1')
  try {
    expect(restored.store.records.map(({ key, pinned }) => ({ key, pinned }))).toEqual([
      { key: '/reports', pinned: true },
      { key: '/users/1', pinned: undefined },
    ])
    restored.tabs.pinTab('/reports', false)
    expect(restored.store.records.find((item) => item.key === '/reports')?.pinned).toBe(false)
  } finally {
    restored.wrapper.unmount()
  }
})

test('saves dragged tab order without changing the active route or fixed state', async () => {
  const first = await setup('/users/1')
  await first.router.push('/users/2')
  await first.router.push('/reports')
  first.tabs.pinTab('/users/1', true)
  first.tabs.moveTab('/reports', '/users/1', 'before')
  first.tabs.moveTab('/reports', '/users/2', 'before')
  expect(first.store.records.map(({ key, pinned }) => ({ key, pinned: Boolean(pinned) }))).toEqual([
    { key: '/users/1', pinned: true },
    { key: '/reports', pinned: false },
    { key: '/users/2', pinned: false },
  ])
  expect(first.router.currentRoute.value.fullPath).toBe('/reports')
  first.wrapper.unmount()

  const restored = await setup('/reports')
  try {
    expect(restored.store.records.map(({ key }) => key)).toEqual(['/users/1', '/reports', '/users/2'])
    expect(restored.store.records[0]?.pinned).toBe(true)
  } finally {
    restored.wrapper.unmount()
  }
})

test('navigates to the clicked tab after bulk close and refreshes an inactive tab', async () => {
  const { wrapper, router, store, tabs } = await setup('/users/1')
  try {
    await router.push('/reports')
    await nextTick()
    tabs.refreshTab('/users/1')
    expect(store.getRenderKey('/users/1')).toBe('/users/1:1')

    await tabs.closeOtherTabs('/users/1')
    expect(router.currentRoute.value.fullPath).toBe('/users/1')
    expect(store.records.map((item) => item.key)).toEqual(['/users/1'])

    await router.push('/reports')
    await tabs.closeRightTabs('/users/1')
    expect(router.currentRoute.value.fullPath).toBe('/users/1')
    expect(store.records.map((item) => item.key)).toEqual(['/users/1'])
  } finally {
    wrapper.unmount()
  }
})
