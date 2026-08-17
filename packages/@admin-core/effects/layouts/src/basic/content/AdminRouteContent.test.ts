// @vitest-environment happy-dom

import type { AdminTabRecord } from '@monorepo-admin-core/types'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, nextTick, onActivated, onDeactivated, onUnmounted, ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, expect, test } from 'vite-plus/test'
import { useAdminTabStore } from '@monorepo-admin-core/stores'
import AdminRouteContent from './AdminRouteContent.vue'

const lifecycle = {
  cachedActivated: 0,
  cachedDeactivated: 0,
  cachedUnmounted: 0,
  plainMounted: 0,
  plainUnmounted: 0,
}

const CachedPage = defineComponent({
  name: 'CachedPage',
  setup() {
    const count = ref(0)
    lifecycle.cachedActivated += 1
    onActivated(() => {
      lifecycle.cachedActivated += 1
    })
    onDeactivated(() => {
      lifecycle.cachedDeactivated += 1
    })
    onUnmounted(() => {
      lifecycle.cachedUnmounted += 1
    })

    return () => h('button', { 'data-testid': 'cached-count', onClick: () => (count.value += 1), type: 'button' }, String(count.value))
  },
})

const PlainPage = defineComponent({
  name: 'PlainPage',
  setup() {
    lifecycle.plainMounted += 1
    onUnmounted(() => {
      lifecycle.plainUnmounted += 1
    })
    return () => h('div', { 'data-testid': 'plain-page' }, 'plain')
  },
})

function createScrollablePage(testId: string) {
  return defineComponent({
    name: `ScrollablePage${testId}`,
    setup() {
      return () =>
        h(
          'div',
          {
            'data-testid': testId,
            style: {
              height: '20px',
              overflow: 'auto',
              width: '20px',
            },
          },
          h('div', { style: { height: '500px', width: '500px' } }),
        )
    },
  })
}

const ScrollablePageA = createScrollablePage('scroll-a')
const ScrollablePageB = createScrollablePage('scroll-b')

beforeEach(() => {
  sessionStorage.clear()
  document.body.scrollLeft = 0
  document.body.scrollTop = 0
  document.documentElement.scrollLeft = 0
  document.documentElement.scrollTop = 0
  Object.assign(lifecycle, {
    cachedActivated: 0,
    cachedDeactivated: 0,
    cachedUnmounted: 0,
    plainMounted: 0,
    plainUnmounted: 0,
  })
})

test('keeps opted-in page state and destroys non-cached pages when switching tabs', async () => {
  const { router, store, wrapper } = await mountContent([createRecord('/cached', { keepAlive: true }), createRecord('/plain')])

  await wrapper.get('[data-testid="cached-count"]').trigger('click')
  expect(wrapper.get('[data-testid="cached-count"]').text()).toBe('1')

  await activate(store, router, '/plain')
  expect(wrapper.find('[data-testid="cached-count"]').exists()).toBe(false)
  expect(wrapper.get('[data-testid="plain-page"]').text()).toBe('plain')
  expect(lifecycle.cachedDeactivated).toBe(1)

  await activate(store, router, '/cached')
  expect(wrapper.get('[data-testid="cached-count"]').text()).toBe('1')
  expect(lifecycle.plainUnmounted).toBe(1)

  store.refresh('/cached')
  await nextTick()
  expect(wrapper.get('[data-testid="cached-count"]').text()).toBe('0')
  expect(lifecycle.cachedUnmounted).toBe(1)

  await activate(store, router, '/plain')
  expect(lifecycle.plainMounted).toBe(2)

  store.refresh('/plain')
  await nextTick()
  expect(lifecycle.plainMounted).toBe(3)
  expect(lifecycle.plainUnmounted).toBe(2)

  store.close('/cached')
  await nextTick()
  expect(lifecycle.cachedUnmounted).toBe(2)
  wrapper.unmount()
})

test('lazily mounts restored iframes, keeps opted-in instances and refreshes only the active frame', async () => {
  const persistentIframe = createRecord('/persistent-frame', {
    iframeSrc: 'https://example.com/persistent',
    keepAlive: true,
  })
  const transientIframe = createRecord('/transient-frame', {
    iframeSrc: 'https://example.com/transient',
  })
  const { router, store, wrapper } = await mountContent([persistentIframe, transientIframe, createRecord('/plain')], '/plain')

  expect(wrapper.find('iframe').exists()).toBe(false)

  await activate(store, router, '/persistent-frame')
  const initialPersistentElement = wrapper.get('iframe').element

  store.refresh('/persistent-frame')
  await nextTick()
  const refreshedPersistentElement = wrapper.get('iframe').element
  expect(refreshedPersistentElement).not.toBe(initialPersistentElement)

  await activate(store, router, '/plain')
  expect(wrapper.get('iframe').element).toBe(refreshedPersistentElement)
  expect(wrapper.get('iframe').element.closest('div')?.style.display).toBe('none')

  await activate(store, router, '/transient-frame')
  expect(wrapper.findAll('iframe')).toHaveLength(2)
  const initialTransientElement = wrapper.findAll('iframe')[1]?.element

  store.refresh('/transient-frame')
  await nextTick()
  expect(wrapper.findAll('iframe')[1]?.element).not.toBe(initialTransientElement)

  await activate(store, router, '/plain')
  expect(wrapper.findAll('iframe')).toHaveLength(1)
  expect(wrapper.get('iframe').element).toBe(refreshedPersistentElement)

  store.close('/persistent-frame')
  await nextTick()
  expect(wrapper.find('iframe').exists()).toBe(false)
  wrapper.unmount()
})

test('restores shared and nested scroll containers independently for each cached tab', async () => {
  const { router, store, wrapper } = await mountContent([createRecord('/scroll-a', { keepAlive: true }), createRecord('/scroll-b', { keepAlive: true })])
  const contentRoot = wrapper.get('span[aria-hidden="true"]').element.parentElement as HTMLElement
  const documentScroller = document.scrollingElement instanceof HTMLElement ? document.scrollingElement : document.documentElement
  const scrollA = wrapper.get('[data-testid="scroll-a"]').element as HTMLElement

  document.body.scrollTop = 410
  document.body.dispatchEvent(new Event('scroll'))
  documentScroller.scrollTop = 310
  document.dispatchEvent(new Event('scroll'))
  contentRoot.scrollTop = 200
  contentRoot.dispatchEvent(new Event('scroll'))
  scrollA.scrollLeft = 18
  scrollA.scrollTop = 120
  scrollA.dispatchEvent(new Event('scroll'))
  scrollA.scrollTop = 121
  scrollA.dispatchEvent(new Event('scroll'))
  scrollA.scrollTop = 120
  scrollA.dispatchEvent(new Event('scroll'))

  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  expect(store.getScrollPositions('/scroll-a')).toEqual({})

  await activate(store, router, '/scroll-b')
  expect(Object.values(store.getScrollPositions('/scroll-a'))).toContainEqual({ left: 0, top: 410 })
  expect(Object.values(store.getScrollPositions('/scroll-a'))).toContainEqual({ left: 0, top: 310 })
  expect(Object.values(store.getScrollPositions('/scroll-a'))).toContainEqual({ left: 18, top: 120 })
  expect(Object.values(store.getScrollPositions('/scroll-a'))).toContainEqual({ left: 0, top: 200 })
  const scrollB = wrapper.get('[data-testid="scroll-b"]').element as HTMLElement

  // 模拟浏览器把移入 KeepAlive 隐藏容器的滚动元素重置
  scrollA.scrollLeft = 0
  scrollA.scrollTop = 0
  document.body.scrollTop = 65
  document.body.dispatchEvent(new Event('scroll'))
  documentScroller.scrollTop = 55
  document.dispatchEvent(new Event('scroll'))
  contentRoot.scrollTop = 35
  contentRoot.dispatchEvent(new Event('scroll'))
  scrollB.scrollTop = 45
  scrollB.dispatchEvent(new Event('scroll'))

  await activate(store, router, '/scroll-a')

  expect(contentRoot.style.visibility).toBe('hidden')
  document.body.scrollTop = 0
  documentScroller.scrollTop = 0
  contentRoot.scrollTop = 0
  scrollA.scrollLeft = 0
  scrollA.scrollTop = 0
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

  expect(contentRoot.style.visibility).toBe('')
  expect(document.body.scrollTop).toBe(410)
  expect(documentScroller.scrollTop).toBe(310)
  expect(contentRoot.scrollTop).toBe(200)
  expect(wrapper.get('[data-testid="scroll-a"]').element).toBe(scrollA)
  expect(scrollA.scrollLeft).toBe(18)
  expect(scrollA.scrollTop).toBe(120)
  wrapper.unmount()
})

async function mountContent(records: AdminTabRecord[], initialPath = records[0]?.viewPath ?? '/plain') {
  const pinia = createPinia()
  setActivePinia(pinia)

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { component: CachedPage, path: '/cached' },
      { component: PlainPage, path: '/plain' },
      { component: PlainPage, path: '/persistent-frame' },
      { component: ScrollablePageA, path: '/scroll-a' },
      { component: ScrollablePageB, path: '/scroll-b' },
      { component: PlainPage, path: '/transient-frame' },
    ],
  })
  await router.push(initialPath)

  const store = useAdminTabStore()
  store.initialize('test:content-tabs', records)
  store.setActive(records.find((item) => item.viewPath === initialPath)?.key ?? initialPath)

  const wrapper = mount(AdminRouteContent, {
    global: {
      plugins: [pinia, router],
      stubs: {
        UButton: true,
        UIcon: true,
      },
    },
  })
  await router.isReady()
  await nextTick()

  return { router, store, wrapper }
}

async function activate(store: ReturnType<typeof useAdminTabStore>, router: ReturnType<typeof createRouter>, key: string) {
  store.setActive(key)
  await router.push(key)
  await nextTick()
}

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
