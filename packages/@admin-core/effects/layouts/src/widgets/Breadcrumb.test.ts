// @vitest-environment happy-dom

import type { PropType } from 'vue'
import { mount } from '@vue/test-utils'
import { expect, test } from 'vite-plus/test'
import { defineComponent, h } from 'vue'
import Breadcrumb from './Breadcrumb.vue'

const BreadcrumbStub = defineComponent({
  props: {
    items: Array as PropType<Array<Record<string, unknown>>>,
  },
  setup(props, { slots }) {
    return () =>
      h(
        'nav',
        { 'data-breadcrumb': '' },
        props.items?.map((item, index) =>
          h('div', { 'data-breadcrumb-item': '' }, [
            slots['item-leading']?.({ active: index === props.items!.length - 1, item }),
            slots['item-label']?.({ active: index === props.items!.length - 1, item }),
          ]),
        ),
      )
  },
})

test('combines prefix and route breadcrumbs into Nuxt UI items', () => {
  const wrapper = mount(Breadcrumb, {
    props: {
      breadcrumbPrefix: [{ title: '首页', path: '/', icon: 'i-lucide-house' }],
      breadcrumbs: [{ title: '用户管理', path: '/system/user', icon: 'i-lucide-users' }],
    },
    global: {
      stubs: {
        UBreadcrumb: BreadcrumbStub,
        UIcon: defineComponent({ props: { name: String }, setup: (props) => () => h('i', { 'data-icon': props.name }) }),
      },
    },
  })

  expect(wrapper.getComponent(BreadcrumbStub).props('items')).toEqual([
    { icon: 'i-lucide-house', label: '首页', menuIcon: 'i-lucide-house', to: '/' },
    { icon: 'i-lucide-users', label: '用户管理', menuIcon: 'i-lucide-users', to: '/system/user' },
  ])
  expect(wrapper.findAll('[data-icon]').map((icon) => icon.attributes('data-icon'))).toEqual(['i-lucide-house', 'i-lucide-users'])
  expect(wrapper.findAll('[data-breadcrumb-item]')[1]?.text()).toBe('用户管理')
})

test('supports light and dark image icons', () => {
  const wrapper = mount(Breadcrumb, {
    props: {
      breadcrumbs: [{ title: '品牌', icon: { dark: '/brand-dark.svg', light: '/brand-light.svg' } }],
    },
    global: {
      stubs: {
        UBreadcrumb: BreadcrumbStub,
        UIcon: true,
      },
    },
  })

  expect(wrapper.get('source').attributes('srcset')).toBe('/brand-dark.svg')
  expect(wrapper.get('img').attributes('src')).toBe('/brand-light.svg')
})

test('does not render an empty breadcrumb', () => {
  const wrapper = mount(Breadcrumb, {
    global: {
      stubs: {
        UBreadcrumb: BreadcrumbStub,
        UIcon: true,
      },
    },
  })

  expect(wrapper.find('[data-breadcrumb]').exists()).toBe(false)
})
