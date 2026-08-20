// @vitest-environment happy-dom

import type { PropType } from 'vue'
import { mount } from '@vue/test-utils'
import { expect, test } from 'vite-plus/test'
import { defineComponent, h } from 'vue'
import LayoutHeader from './LayoutHeader.vue'

const DashboardNavbarStub = defineComponent({
  props: {
    toggle: Boolean,
    ui: Object as PropType<Record<string, unknown>>,
  },
  setup(props, { slots }) {
    const slotProps = { ui: {} }
    return () =>
      h('header', { 'data-dashboard-navbar': '', 'data-toggle': String(props.toggle) }, [
        slots.toggle?.(slotProps),
        slots.left?.(slotProps) ?? [slots.leading?.(slotProps), h('h1', slots.title?.(slotProps)), slots.trailing?.(slotProps)],
        slots.default?.(slotProps),
        slots.right?.(slotProps),
      ])
  },
})

function mountHeader(slots = {}) {
  return mount(LayoutHeader, {
    global: {
      stubs: {
        UDashboardNavbar: DashboardNavbarStub,
      },
    },
    slots,
  })
}

test('uses the dashboard navbar standalone without its dashboard toggle', () => {
  const wrapper = mountHeader()

  expect(wrapper.getComponent(DashboardNavbarStub).props()).toMatchObject({ toggle: false, ui: { root: 'bg-default' } })
})

test('forwards the toggle, left and right navbar slots', () => {
  const wrapper = mountHeader({
    toggle: (props: Record<string, unknown>) => h('span', { 'data-header-toggle': '', 'data-has-ui': String(Boolean(props.ui)) }),
    left: () => h('span', { 'data-header-left': '' }),
    right: () => h('span', { 'data-header-right': '' }),
  })

  expect(wrapper.get('[data-header-toggle]').attributes('data-has-ui')).toBe('true')
  expect(wrapper.find('[data-header-left]').exists()).toBe(true)
  expect(wrapper.find('[data-header-right]').exists()).toBe(true)
})

test('does not expose the navbar detail slots', () => {
  const wrapper = mountHeader({
    leading: () => h('span', { 'data-header-leading': '' }),
    title: () => h('span', { 'data-header-title': '' }),
    trailing: () => h('span', { 'data-header-trailing': '' }),
    default: () => h('span', { 'data-header-default': '' }),
  })

  expect(wrapper.find('[data-header-leading]').exists()).toBe(false)
  expect(wrapper.find('[data-header-title]').exists()).toBe(false)
  expect(wrapper.find('[data-header-trailing]').exists()).toBe(false)
  expect(wrapper.find('[data-header-default]').exists()).toBe(false)
})
