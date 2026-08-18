// @vitest-environment happy-dom

import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, test, vi } from 'vite-plus/test'
import Fallback from '../Fallback.vue'

const EmptyStub = defineComponent({
  inheritAttrs: false,
  setup(_props, { attrs, slots }) {
    return () => h('div', { ...attrs, 'data-empty': true }, [slots.header?.(), slots.body?.()])
  },
})

const IconStub = defineComponent({
  inheritAttrs: false,
  props: {
    name: String,
  },
  setup(props, { attrs }) {
    return () => h('svg', { ...attrs, 'data-icon': props.name })
  },
})

const ButtonStub = defineComponent({
  inheritAttrs: false,
  props: {
    color: String,
    icon: String,
    label: String,
    to: String,
    type: String,
  },
  emits: ['click'],
  setup(props, { attrs, emit }) {
    return () =>
      h(
        'button',
        {
          ...attrs,
          'data-icon': props.icon,
          'data-to': props.to,
          type: props.type ?? 'button',
          onClick: (event: MouseEvent) => emit('click', event),
        },
        props.label,
      )
  },
})

function mountFallback(options: Parameters<typeof mount<typeof Fallback>>[1] = {}) {
  return mount(Fallback, {
    ...options,
    global: {
      ...options.global,
      stubs: { UButton: ButtonStub, UEmpty: EmptyStub, UIcon: IconStub },
    },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('default states', () => {
  test.each([
    ['403', '无访问权限', '当前账号暂无权限访问此页面，请联系管理员。', '返回首页'],
    ['404', '页面不存在', '你访问的页面不存在，可能已被移动或删除。', '返回首页'],
    ['500', '页面发生错误', '页面加载失败，请稍后重试。', '重新加载'],
    ['coming-soon', '敬请期待', '该功能正在建设中，敬请期待。', undefined],
    ['offline', '网络连接已断开', '请检查网络连接后重试。', '重新加载'],
  ] as const)('renders the %s state with its built-in copy and icon', (status, title, description, action) => {
    const wrapper = mountFallback({ props: { status } })

    expect(wrapper.get('h1').text()).toBe(title)
    expect(wrapper.get('p').text()).toBe(description)
    expect(wrapper.find('[data-fallback-icon]').exists()).toBe(status !== '403' && status !== '404')
    expect(wrapper.get('[data-status]').attributes('data-status')).toBe(status)

    const button = wrapper.find('button')
    expect(button.exists()).toBe(Boolean(action))
    expect(button.exists() ? button.text() : '').toBe(action ?? '')
  })

  test('uses coming-soon when no status is provided', () => {
    const wrapper = mountFallback()

    expect(wrapper.get('h1').text()).toBe('敬请期待')
    expect(wrapper.get('[data-status]').attributes('data-status')).toBe('coming-soon')
  })
})

test.each(['403', '404'] as const)('renders %s as a number instead of an icon', (status) => {
  const wrapper = mountFallback({ props: { status } })

  expect(wrapper.get('[data-fallback-code]').text()).toBe(status)
  expect(wrapper.find('[data-fallback-icon]').exists()).toBe(false)
})

test.each([
  ['403', 'bg-warning/5'],
  ['404', 'bg-muted/10'],
  ['500', 'bg-error/5'],
  ['coming-soon', 'bg-primary/5'],
  ['offline', 'bg-info/5'],
] as const)('uses the icon color for the centered top glow on %s', (status, glowClass) => {
  const wrapper = mountFallback({ props: { status } })

  expect(wrapper.get('[data-fallback-glow]').classes()).toContain(glowClass)
  expect(wrapper.html()).not.toContain('-bottom-40')
})

test('keeps the 404 glow visible in dark mode', () => {
  const wrapper = mountFallback({ props: { status: '404' } })

  expect(wrapper.get('[data-fallback-glow]').classes()).toContain('dark:bg-muted/20')
})

test('uses the supplied home path for 403 and 404 actions', () => {
  for (const status of ['403', '404'] as const) {
    const wrapper = mountFallback({ props: { homePath: '/system/role', status } })

    expect(wrapper.get('button').attributes('data-to')).toBe('/system/role')
    expect(wrapper.get('button').attributes('data-icon')).toBe('i-lucide-arrow-left')
  }
})

test('emits reload for 500 and offline actions', async () => {
  for (const status of ['500', 'offline'] as const) {
    const wrapper = mountFallback({ props: { status } })
    await wrapper.get('button').trigger('click')

    expect(wrapper.emitted('reload')).toHaveLength(1)
  }
})

test('supports custom copy, image, and action visibility', () => {
  const wrapper = mountFallback({
    props: {
      description: '自定义描述',
      image: '/custom-fallback.png',
      imageAlt: '自定义插图',
      showAction: false,
      title: '自定义标题',
    },
  })

  expect(wrapper.get('h1').text()).toBe('自定义标题')
  expect(wrapper.get('p').text()).toBe('自定义描述')
  expect(wrapper.get('img').attributes()).toMatchObject({ alt: '自定义插图', src: '/custom-fallback.png' })
  expect(wrapper.get('img').attributes('aria-hidden')).toBeUndefined()
  expect(wrapper.get('img').element.parentElement?.getAttribute('aria-hidden')).toBeNull()
  expect(wrapper.find('button').exists()).toBe(false)
})

test('allows all content slots to replace their default content', () => {
  const wrapper = mountFallback({
    props: { status: '404' },
    slots: {
      action: '<button data-slot-action type="button">自定义操作</button>',
      description: '<span data-slot-description>插槽描述</span>',
      illustration: '<div data-slot-illustration>插槽插图</div>',
      title: '<span data-slot-title>插槽标题</span>',
    },
  })

  expect(wrapper.get('[data-slot-illustration]').text()).toBe('插槽插图')
  expect(wrapper.get('[data-slot-title]').text()).toBe('插槽标题')
  expect(wrapper.get('[data-slot-description]').text()).toBe('插槽描述')
  expect(wrapper.get('[data-slot-action]').text()).toBe('自定义操作')
  expect(wrapper.findComponent(ButtonStub).exists()).toBe(false)
})

test('forwards root attributes and treats an image without alt text as decorative', () => {
  const wrapper = mountFallback({
    attrs: {
      'aria-label': 'fallback container',
      class: 'custom-fallback',
      'data-testid': 'fallback',
    },
    props: { image: '/decorative.png' },
  })

  const root = wrapper.get('[data-testid="fallback"]')
  expect(root.classes()).toContain('custom-fallback')
  expect(root.attributes('aria-label')).toBe('fallback container')
  expect(wrapper.get('img').attributes()).toMatchObject({ alt: '', 'aria-hidden': 'true' })
})
