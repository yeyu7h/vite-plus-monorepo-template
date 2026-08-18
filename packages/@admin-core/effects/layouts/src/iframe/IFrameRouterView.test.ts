// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { Page } from '@monorepo-admin-core/common-ui'
import { afterEach, beforeEach, expect, test, vi } from 'vite-plus/test'
import { defineComponent, h, nextTick, ref, vShow, withDirectives } from 'vue'
import IFrameRouterView from './IFrameRouterView.vue'

const UButtonStub = defineComponent({
  inheritAttrs: false,
  props: {
    rel: String,
    target: String,
    to: String,
  },
  emits: ['click'],
  setup(props, { attrs, emit, slots }) {
    return () =>
      props.to
        ? h('a', { ...attrs, href: props.to, rel: props.rel, target: props.target }, slots.default?.())
        : h('button', { ...attrs, onClick: () => emit('click'), type: 'button' }, slots.default?.())
  },
})

function mountIframeView(props: { src?: string; title?: string } = {}) {
  return mount(IFrameRouterView, {
    props: {
      src: 'https://example.com/docs',
      title: '示例文档',
      ...props,
    },
    global: {
      stubs: {
        UButton: UButtonStub,
        UIcon: true,
      },
    },
  })
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
})

test('always renders a fill-height Page and omits the iframe without a source', () => {
  const wrapper = mountIframeView({ src: '' })

  expect(wrapper.getComponent(Page).classes()).toContain('flex')
  expect(wrapper.getComponent(Page).classes()).toContain('overflow-hidden')
  expect(wrapper.find('iframe').exists()).toBe(false)
  wrapper.unmount()
})

test('renders the iframe route passed by the cache pool', () => {
  const wrapper = mountIframeView({
    src: ' https://example.com/after-navigation ',
    title: '导航后的文档',
  })

  expect(wrapper.get('iframe').attributes('src')).toBe('https://example.com/after-navigation')
  expect(wrapper.get('iframe').attributes('title')).toBe('导航后的文档')
  const iframeContainer = wrapper.get('iframe').element.parentElement
  expect(iframeContainer?.classList.contains('relative')).toBe(true)
  expect(iframeContainer?.classList.contains('min-h-0')).toBe(true)
  expect(iframeContainer?.classList.contains('flex-1')).toBe(true)
  expect(iframeContainer?.classList.contains('overflow-hidden')).toBe(true)
  expect(wrapper.get('[role="status"]').text()).toContain('正在加载导航后的文档')
  wrapper.unmount()
})

test('renders an accessible loading state and hides it after load', async () => {
  const wrapper = mountIframeView()
  const iframe = wrapper.get('iframe')

  expect(iframe.attributes('src')).toBe('https://example.com/docs')
  expect(iframe.attributes('title')).toBe('示例文档')
  expect(wrapper.get('[role="status"]').text()).toContain('正在加载示例文档')

  await iframe.trigger('load')

  expect(wrapper.find('[role="status"]').exists()).toBe(false)
  wrapper.unmount()
})

test('shows timeout actions with a safe external link', async () => {
  const wrapper = mountIframeView()

  vi.advanceTimersByTime(15_000)
  await nextTick()

  expect(wrapper.get('[role="alert"]').text()).toContain('页面暂未完成加载')
  expect(wrapper.get('[role="alert"]').text()).toContain('可能加载较慢')

  const externalLink = wrapper.get('a')
  expect(externalLink.attributes('href')).toBe('https://example.com/docs')
  expect(externalLink.attributes('target')).toBe('_blank')
  expect(externalLink.attributes('rel')).toBe('noopener noreferrer')
  wrapper.unmount()
})

test('recreates the iframe and restarts loading when retrying', async () => {
  const wrapper = mountIframeView()
  const initialIframe = wrapper.get('iframe').element

  vi.advanceTimersByTime(15_000)
  await nextTick()
  await wrapper.get('button').trigger('click')

  expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  expect(wrapper.get('[role="status"]').text()).toContain('正在加载示例文档')
  expect(wrapper.get('iframe').element).not.toBe(initialIframe)
  wrapper.unmount()
})

test('applies v-show to the Page root for cached iframe tabs', async () => {
  const visible = ref(false)
  const Host = defineComponent({
    setup() {
      return () => withDirectives(h(IFrameRouterView, { src: 'https://example.com/docs' }), [[vShow, visible.value]])
    },
  })

  const wrapper = mount(Host, {
    global: {
      stubs: {
        UButton: UButtonStub,
        UIcon: true,
      },
    },
  })
  const page = wrapper.getComponent(Page)

  expect(page.element.style.display).toBe('none')

  visible.value = true
  await nextTick()

  expect(page.element.style.display).toBe('')
  wrapper.unmount()
})
