// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vite-plus/test'
import LayoutSidebar from './LayoutSidebar.vue'

class ResizeObserverMock {
  static instances: ResizeObserverMock[] = []

  readonly disconnect = vi.fn<() => void>()
  readonly observe = vi.fn<(target: Element, options?: ResizeObserverOptions) => void>()

  constructor(private readonly callback: ResizeObserverCallback) {
    ResizeObserverMock.instances.push(this)
  }

  trigger(width: number) {
    const entry = {
      borderBoxSize: [{ inlineSize: width }],
      contentRect: { width },
    } as unknown as ResizeObserverEntry

    this.callback([entry], this as unknown as ResizeObserver)
  }
}

const DashboardSidebarStub = defineComponent({
  inheritAttrs: false,
  setup(_, { slots }) {
    return () => h('aside', { 'data-slot': 'root' }, [slots.header?.({ collapsed: false }), slots.default?.({ collapsed: false, collapse: () => {} })])
  },
})

function mountSidebar(contentMode: 'default' | 'full' = 'default', scrollMode: 'document' | 'panel' = 'panel') {
  const currentContentMode = ref(contentMode)
  const currentScrollMode = ref(scrollMode)
  const wrapper = mount(
    defineComponent({
      setup() {
        return () =>
          h(LayoutSidebar, {
            contentMode: currentContentMode.value,
            scrollMode: currentScrollMode.value,
          })
      },
    }),
    {
      global: {
        stubs: {
          UDashboardSidebar: DashboardSidebarStub,
        },
      },
    },
  )

  return {
    contentMode: currentContentMode,
    scrollMode: currentScrollMode,
    wrapper,
  }
}

beforeEach(() => {
  ResizeObserverMock.instances = []
  vi.stubGlobal('ResizeObserver', ResizeObserverMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('LayoutSidebar width observation', () => {
  test('observes and synchronizes the fixed sidebar width only in document mode', async () => {
    const { contentMode, wrapper } = mountSidebar('default', 'document')
    await nextTick()

    expect(ResizeObserverMock.instances).toHaveLength(1)

    const observer = ResizeObserverMock.instances[0]
    expect(observer?.observe).toHaveBeenCalledOnce()

    observer?.trigger(320)
    await nextTick()

    expect(wrapper.attributes('style')).toContain('--sidebar-placeholder-width: 320px')

    contentMode.value = 'full'
    await nextTick()

    expect(observer?.disconnect).toHaveBeenCalledOnce()

    contentMode.value = 'default'
    await nextTick()

    expect(ResizeObserverMock.instances).toHaveLength(2)

    const nextObserver = ResizeObserverMock.instances[1]
    wrapper.unmount()

    expect(nextObserver?.disconnect).toHaveBeenCalledOnce()
  })

  test('does not observe panel or full layouts until document mode becomes active', async () => {
    const { contentMode, scrollMode, wrapper } = mountSidebar()
    await nextTick()

    expect(ResizeObserverMock.instances).toHaveLength(0)

    scrollMode.value = 'document'
    await nextTick()

    expect(ResizeObserverMock.instances).toHaveLength(1)

    const observer = ResizeObserverMock.instances[0]
    contentMode.value = 'full'
    await nextTick()

    expect(observer?.disconnect).toHaveBeenCalledOnce()
    wrapper.unmount()
  })
})
