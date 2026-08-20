// @vitest-environment happy-dom

import type { PropType } from 'vue'
import { mount } from '@vue/test-utils'
import { expect, test } from 'vite-plus/test'
import { defineComponent, h } from 'vue'
import Header from './Header.vue'

const DashboardNavbarStub = defineComponent({
  props: {
    toggle: Boolean,
  },
  setup(_, { slots }) {
    const slotProps = { ui: {} }
    return () =>
      h('header', { 'data-dashboard-navbar': '' }, [
        slots.toggle?.(slotProps),
        slots.left?.(slotProps) ?? [slots.leading?.(slotProps), slots.title?.(slotProps), slots.trailing?.(slotProps)],
        slots.default?.(slotProps),
        slots.right?.(slotProps),
      ])
  },
})

const BreadcrumbStub = defineComponent({
  props: {
    breadcrumbPrefix: Array as PropType<unknown[]>,
    breadcrumbs: Array as PropType<unknown[]>,
  },
  setup(props) {
    return () => h('nav', { 'data-breadcrumb-count': String((props.breadcrumbPrefix?.length ?? 0) + (props.breadcrumbs?.length ?? 0)) })
  },
})

test('uses the breadcrumb widget as the default header left content', () => {
  const wrapper = mount(Header, {
    props: {
      breadcrumbPrefix: [{ title: '首页' }],
      breadcrumbs: [{ title: '用户管理' }],
    },
    global: {
      stubs: {
        Breadcrumb: BreadcrumbStub,
        UDashboardNavbar: DashboardNavbarStub,
      },
    },
  })

  expect(wrapper.find('[data-dashboard-navbar]').exists()).toBe(true)
  expect(wrapper.get('[data-breadcrumb-count]').attributes('data-breadcrumb-count')).toBe('2')
})

test('exposes the toggle, left and right header slots', () => {
  const wrapper = mount(Header, {
    global: {
      stubs: {
        Breadcrumb: BreadcrumbStub,
        UDashboardNavbar: DashboardNavbarStub,
      },
    },
    slots: {
      toggle: () => h('span', { 'data-toggle': '' }),
      left: () => h('span', { 'data-left': '' }),
      right: () => h('span', { 'data-right': '' }),
    },
  })

  for (const slot of ['toggle', 'left', 'right']) {
    expect(wrapper.find(`[data-${slot}]`).exists()).toBe(true)
  }
  expect(wrapper.find('[data-breadcrumb-count]').exists()).toBe(false)
})
