// @vitest-environment happy-dom

import type { PropType } from 'vue'
import { mount } from '@vue/test-utils'
import { beforeEach, expect, test, vi } from 'vite-plus/test'
import { defineComponent, h } from 'vue'
import LayoutSidebar from './LayoutSidebar.vue'

const STORAGE_KEY = 'test:layout-sidebar-collapsed'

beforeEach(() => localStorage.clear())

const DashboardSidebarStub = defineComponent({
  inheritAttrs: false,
  props: {
    collapsed: Boolean,
    collapsedSize: Number,
    defaultSize: Number,
    maxSize: Number,
    minSize: Number,
    resizable: Boolean,
    ui: Object as PropType<Record<string, unknown>>,
  },
  emits: ['update:collapsed', 'update:open'],
  setup(props, { attrs, emit, slots }) {
    const slotProps = () => ({ collapsed: props.collapsed, collapse: (value: boolean) => emit('update:collapsed', value) })
    return () =>
      h('aside', { ...attrs, 'data-collapsed': String(props.collapsed) }, [
        slots.header?.(slotProps()),
        h('div', { 'data-slot': 'body' }, slots.default?.(slotProps())),
        h('div', { 'data-slot': 'footer' }, slots.footer?.(slotProps())),
      ])
  },
})

const ButtonStub = defineComponent({
  inheritAttrs: false,
  props: {
    ui: Object as PropType<Record<string, string>>,
  },
  emits: ['click'],
  setup(_props, { attrs, emit }) {
    return () => h('button', { ...attrs, onClick: () => emit('click') })
  },
})

test('uses fixed widths and temporarily expands without changing collapsed state', async () => {
  const wrapper = mount(LayoutSidebar, {
    props: {
      storageKey: STORAGE_KEY,
    },
    global: {
      stubs: {
        UButton: ButtonStub,
        UDashboardSidebar: DashboardSidebarStub,
      },
    },
    slots: {
      menu: ({ collapsed, opened, setOverlayOpen }: { collapsed: boolean; opened: boolean; setOverlayOpen: (value: boolean) => void }) =>
        h('div', [h('output', { 'data-collapsed': String(collapsed), 'data-opened': String(opened) }), h('button', { 'data-menu-overlay-open': '', onClick: () => setOverlayOpen(true) })]),
      footer: ({ collapsed, opened, setOverlayOpen }: { collapsed: boolean; opened: boolean; setOverlayOpen: (value: boolean, reason?: 'selection') => void }) =>
        h('div', [
          h('span', { 'data-sidebar-footer-state': '', 'data-collapsed': String(collapsed), 'data-opened': String(opened) }),
          h('button', { 'data-footer-overlay-close': '', onClick: () => setOverlayOpen(false) }),
          h('button', { 'data-footer-overlay-select': '', onClick: () => setOverlayOpen(false, 'selection') }),
        ]),
    },
  })
  const sidebar = wrapper.getComponent(DashboardSidebarStub)
  const rootUi = sidebar.props('ui')?.root as string[]

  expect(sidebar.props()).toMatchObject({ collapsedSize: 64, defaultSize: 240, maxSize: 240, minSize: 240, resizable: false })
  expect(wrapper.get('[data-sidebar-logo]').text()).toBe('Logo')
  expect(wrapper.get('[data-sidebar-logo-icon]').attributes()).toMatchObject({
    src: 'https://raw.githubusercontent.com/Koolson/Qure/refs/heads/master/IconSet/Color/Apple.png',
    alt: '',
  })
  expect(wrapper.get('[data-sidebar-logo-text]').classes()).toContain('opacity-100')
  expect(rootUi[0]).toContain('transition-[width]')
  expect(rootUi[1]).toContain('after:transition-[width,box-shadow]')
  expect(rootUi).toContain('after:w-60')
  expect(sidebar.props('ui')?.header).toContain('relative z-10 overflow-hidden bg-transparent px-4 transition-[width] duration-200 ease-out')
  expect(sidebar.props('ui')?.body).toContain('relative z-10 overflow-x-hidden bg-transparent px-4 transition-[width] duration-200 ease-out')
  expect(sidebar.props('ui')?.body).toContain(
    '[scrollbar-color:var(--ui-border-accented)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-corner]:bg-transparent [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[var(--ui-border-accented)]',
  )
  expect(sidebar.props('ui')?.footer).toEqual(
    expect.arrayContaining(['relative z-10 overflow-hidden border-t border-default bg-transparent px-3 py-2.5 transition-[width] duration-200 ease-out', 'w-60']),
  )
  expect(wrapper.get('[data-sidebar-footer-state]').attributes()).toMatchObject({ 'data-collapsed': 'false', 'data-opened': 'true' })
  expect(wrapper.find('[data-sidebar-collapse]').exists()).toBe(true)
  expect(wrapper.getComponent(ButtonStub).props('ui')).toEqual({ leadingIcon: 'size-4' })
  expect(wrapper.get('[data-sidebar-collapse]').attributes()).toMatchObject({ 'aria-label': '取消固定侧边栏', icon: 'i-lucide-pin-off', title: '取消固定侧边栏' })
  expect(wrapper.get('[data-sidebar-collapse]').classes()).toEqual(expect.arrayContaining(['absolute', 'inset-e-0', 'opacity-100', 'transition-opacity', 'duration-200']))

  await wrapper.get('aside').trigger('mouseenter')
  await wrapper.get('[data-sidebar-collapse]').trigger('click')
  expect(wrapper.get('output').attributes()).toMatchObject({ 'data-collapsed': 'true', 'data-opened': 'true' })
  expect(localStorage.getItem(STORAGE_KEY)).toBe('true')
  expect(sidebar.props('ui')?.root).toEqual(expect.arrayContaining(['after:w-60', 'after:shadow-xl']))
  expect(wrapper.get('[data-sidebar-logo]').element.tagName).toBe('SPAN')
  expect(wrapper.get('[data-sidebar-logo]').text()).toBe('Logo')
  expect(wrapper.get('[data-sidebar-logo-text]').classes()).toEqual(expect.arrayContaining(['opacity-100', 'transition-opacity', 'duration-200']))
  expect(wrapper.get('[data-sidebar-collapse]').classes()).toEqual(expect.arrayContaining(['opacity-100', 'transition-opacity', 'duration-200']))
  expect(wrapper.get('[data-sidebar-collapse]').attributes()).toMatchObject({ 'aria-label': '固定侧边栏', icon: 'i-lucide-pin', title: '固定侧边栏' })

  await wrapper.get('[data-menu-overlay-open]').trigger('click')
  const sidebarElement = wrapper.get('aside')
  await sidebarElement.trigger('mouseleave')
  expect(wrapper.get('output').attributes()).toMatchObject({ 'data-collapsed': 'true', 'data-opened': 'true' })
  expect(wrapper.get('[data-sidebar-footer-state]').attributes()).toMatchObject({ 'data-collapsed': 'true', 'data-opened': 'true' })
  expect(sidebar.props('ui')?.footer).toContain('w-60')

  const matchesHover = vi.spyOn(sidebarElement.element, 'matches').mockImplementation((selector) => selector === ':hover')
  vi.useFakeTimers()
  await wrapper.get('[data-footer-overlay-close]').trigger('click')
  expect(wrapper.get('output').attributes()).toMatchObject({ 'data-collapsed': 'true', 'data-opened': 'true' })
  await vi.advanceTimersByTimeAsync(120)
  await wrapper.vm.$nextTick()
  vi.useRealTimers()
  matchesHover.mockRestore()
  expect(wrapper.get('output').attributes()).toMatchObject({ 'data-collapsed': 'true', 'data-opened': 'true' })
  expect(wrapper.get('[data-sidebar-footer-state]').attributes()).toMatchObject({ 'data-collapsed': 'true', 'data-opened': 'true' })

  await sidebarElement.trigger('mouseleave')
  expect(wrapper.get('output').attributes()).toMatchObject({ 'data-collapsed': 'true', 'data-opened': 'false' })
  expect(wrapper.get('[data-sidebar-footer-state]').attributes()).toMatchObject({ 'data-collapsed': 'true', 'data-opened': 'false' })
  expect(sidebar.props('ui')?.footer).toContain('w-16')
  expect(sidebar.props('ui')?.root).toEqual(expect.arrayContaining(['after:w-full', 'after:shadow-none']))
  expect(wrapper.get('[data-sidebar-logo-text]').classes()).toContain('opacity-0')
  expect(wrapper.get('[data-sidebar-collapse]').classes()).toEqual(expect.arrayContaining(['pointer-events-none', 'opacity-0', 'transition-opacity', 'duration-200']))
  expect(wrapper.get('[data-sidebar-collapse]').attributes()).toMatchObject({ 'aria-hidden': 'true', tabindex: '-1' })

  await wrapper.get('aside').trigger('mouseenter')
  expect(wrapper.get('output').attributes()).toMatchObject({ 'data-collapsed': 'true', 'data-opened': 'true' })
  expect(wrapper.get('[data-sidebar-footer-state]').attributes()).toMatchObject({ 'data-collapsed': 'true', 'data-opened': 'true' })
  expect(sidebar.props('ui')?.footer).toContain('w-60')
  expect(localStorage.getItem(STORAGE_KEY)).toBe('true')
  expect(wrapper.get('[data-sidebar-logo-text]').classes()).toContain('opacity-100')
  expect(wrapper.get('[data-sidebar-collapse]').attributes()).toMatchObject({ 'aria-label': '固定侧边栏', icon: 'i-lucide-pin', title: '固定侧边栏' })
  expect(wrapper.get('[data-sidebar-collapse]').classes()).toContain('opacity-100')
  expect(sidebar.props('ui')?.root).toEqual(expect.arrayContaining(['after:w-60', 'after:shadow-xl']))

  await wrapper.get('aside').trigger('mouseleave')
  expect(wrapper.get('output').attributes()).toMatchObject({ 'data-collapsed': 'true', 'data-opened': 'false' })

  await wrapper.get('aside').trigger('mouseenter')
  await wrapper.get('[data-menu-overlay-open]').trigger('click')
  await wrapper.get('aside').trigger('mouseleave')
  const matchesOutside = vi.spyOn(sidebarElement.element, 'matches').mockReturnValue(false)
  vi.useFakeTimers()
  await wrapper.get('[data-footer-overlay-select]').trigger('click')
  await vi.advanceTimersByTimeAsync(120)
  await wrapper.vm.$nextTick()
  vi.useRealTimers()
  expect(wrapper.get('output').attributes()).toMatchObject({ 'data-collapsed': 'true', 'data-opened': 'true' })

  document.dispatchEvent(new Event('pointermove'))
  await wrapper.vm.$nextTick()
  matchesOutside.mockRestore()
  expect(wrapper.get('output').attributes()).toMatchObject({ 'data-collapsed': 'true', 'data-opened': 'false' })

  await wrapper.get('aside').trigger('mouseenter')
  await wrapper.get('[data-sidebar-collapse]').trigger('click')
  expect(wrapper.get('output').attributes()).toMatchObject({ 'data-collapsed': 'false', 'data-opened': 'true' })
  expect(localStorage.getItem(STORAGE_KEY)).toBe('false')
  expect(sidebar.props('ui')?.root).toEqual(expect.arrayContaining(['after:w-60', 'after:shadow-none']))
  expect(wrapper.get('[data-sidebar-collapse]').attributes()).toMatchObject({ 'aria-label': '取消固定侧边栏', icon: 'i-lucide-pin-off', title: '取消固定侧边栏' })
})

test('restores the persisted collapsed state when remounted', () => {
  localStorage.setItem(STORAGE_KEY, 'true')

  const wrapper = mount(LayoutSidebar, {
    props: {
      storageKey: STORAGE_KEY,
    },
    global: {
      stubs: {
        UButton: ButtonStub,
        UDashboardSidebar: DashboardSidebarStub,
      },
    },
    slots: {
      menu: ({ collapsed, opened }: { collapsed: boolean; opened: boolean }) => h('output', { 'data-collapsed': String(collapsed), 'data-opened': String(opened) }),
    },
  })

  expect(wrapper.get('output').attributes()).toMatchObject({ 'data-collapsed': 'true', 'data-opened': 'false' })
  expect(wrapper.get('[data-sidebar-logo-text]').classes()).toContain('opacity-0')
  expect(wrapper.get('[data-sidebar-collapse]').attributes()).toMatchObject({ 'aria-hidden': 'true', tabindex: '-1' })
})
