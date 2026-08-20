// @vitest-environment happy-dom

import type { PropType } from 'vue'
import { mount } from '@vue/test-utils'
import { beforeEach, expect, test, vi } from 'vite-plus/test'
import { defineComponent, h } from 'vue'
import LayoutSidebar from './LayoutSidebar.vue'

const STORAGE_KEY = 'test:layout-sidebar-collapsed'

beforeEach(() => localStorage.clear())

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

function mountSidebar() {
  return mount(LayoutSidebar, {
    props: {
      storageKey: STORAGE_KEY,
    },
    global: {
      stubs: {
        UButton: ButtonStub,
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
}

test('keeps a fixed desktop sidebar and reserves its expanded or collapsed width', async () => {
  const wrapper = mountSidebar()
  const sidebar = wrapper.get('aside')
  const sidebarSpace = wrapper.get('[data-sidebar-space]')
  const body = wrapper.get('[data-slot="body"]')
  const footer = wrapper.get('[data-slot="footer"]')

  expect(sidebar.attributes()).toMatchObject({ id: 'primary-navigation', 'data-collapsed': 'false' })
  expect(sidebar.classes()).toEqual(
    expect.arrayContaining(['fixed', 'start-0', 'top-0', 'hidden', 'h-svh', 'lg:flex', 'w-60', 'after:w-60', 'after:shadow-none', 'after:bg-[#FCFCFC]', 'dark:after:bg-[#1A1A1A]']),
  )
  expect(sidebarSpace.classes()).toEqual(expect.arrayContaining(['hidden', 'h-svh', 'lg:block', 'w-60']))
  expect(body.classes()).toEqual(expect.arrayContaining(['flex-1', 'overflow-y-auto', 'overflow-x-hidden', 'w-60']))
  expect(body.classes()).toContain('[scrollbar-width:thin]')
  expect(footer.classes()).toEqual(expect.arrayContaining(['border-t', 'w-60']))
  expect(wrapper.get('output').attributes()).toMatchObject({ 'data-collapsed': 'false', 'data-opened': 'true' })
  expect(wrapper.get('[data-sidebar-logo]').text()).toBe('Logo')
  expect(wrapper.get('[data-sidebar-logo-icon]').attributes()).toMatchObject({
    src: 'https://raw.githubusercontent.com/Koolson/Qure/refs/heads/master/IconSet/Color/Apple.png',
    alt: '',
  })
  expect(wrapper.getComponent(ButtonStub).props('ui')).toEqual({ leadingIcon: 'size-4' })
  expect(wrapper.get('[data-sidebar-collapse]').attributes()).toMatchObject({ 'aria-label': '取消固定侧边栏', icon: 'i-lucide-pin-off', title: '取消固定侧边栏' })

  await wrapper.get('[data-sidebar-collapse]').trigger('click')

  expect(sidebar.attributes('data-collapsed')).toBe('true')
  expect(sidebar.classes()).toEqual(expect.arrayContaining(['w-16', 'after:w-full', 'after:shadow-none']))
  expect(sidebarSpace.classes()).toContain('w-16')
  expect(body.classes()).toContain('w-16')
  expect(footer.classes()).toContain('w-16')
  expect(wrapper.get('output').attributes()).toMatchObject({ 'data-collapsed': 'true', 'data-opened': 'false' })
  expect(wrapper.get('[data-sidebar-logo-text]').classes()).toContain('opacity-0')
  expect(wrapper.get('[data-sidebar-collapse]').attributes()).toMatchObject({ 'aria-hidden': 'true', tabindex: '-1' })
  expect(localStorage.getItem(STORAGE_KEY)).toBe('true')
  expect(wrapper.emitted('update:collapsed')).toEqual([[false], [true]])
})

test('temporarily expands a collapsed sidebar for hover and menu overlays', async () => {
  const wrapper = mountSidebar()
  const sidebar = wrapper.get('aside')
  const body = wrapper.get('[data-slot="body"]')
  const footer = wrapper.get('[data-slot="footer"]')

  await wrapper.get('[data-sidebar-collapse]').trigger('click')
  await sidebar.trigger('mouseenter')

  expect(sidebar.classes()).toEqual(expect.arrayContaining(['w-16', 'after:w-60', 'after:shadow-xl']))
  expect(body.classes()).toContain('w-60')
  expect(footer.classes()).toContain('w-60')
  expect(wrapper.get('output').attributes()).toMatchObject({ 'data-collapsed': 'true', 'data-opened': 'true' })
  expect(wrapper.get('[data-sidebar-logo-text]').classes()).toContain('opacity-100')
  expect(wrapper.get('[data-sidebar-collapse]').attributes()).toMatchObject({ 'aria-label': '固定侧边栏', icon: 'i-lucide-pin' })

  await wrapper.get('[data-menu-overlay-open]').trigger('click')
  await sidebar.trigger('mouseleave')
  expect(wrapper.get('output').attributes('data-opened')).toBe('true')

  const matchesOutside = vi.spyOn(sidebar.element, 'matches').mockReturnValue(false)
  vi.useFakeTimers()
  await wrapper.get('[data-footer-overlay-select]').trigger('click')
  await vi.advanceTimersByTimeAsync(120)
  await wrapper.vm.$nextTick()
  vi.useRealTimers()
  expect(wrapper.get('output').attributes('data-opened')).toBe('true')

  document.dispatchEvent(new Event('pointermove'))
  await wrapper.vm.$nextTick()
  matchesOutside.mockRestore()
  expect(wrapper.get('output').attributes('data-opened')).toBe('false')
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
      },
    },
    slots: {
      menu: ({ collapsed, opened }: { collapsed: boolean; opened: boolean }) => h('output', { 'data-collapsed': String(collapsed), 'data-opened': String(opened) }),
    },
  })

  expect(wrapper.get('aside').classes()).toContain('w-16')
  expect(wrapper.get('output').attributes()).toMatchObject({ 'data-collapsed': 'true', 'data-opened': 'false' })
  expect(wrapper.get('[data-sidebar-logo-text]').classes()).toContain('opacity-0')
  expect(wrapper.get('[data-sidebar-collapse]').attributes()).toMatchObject({ 'aria-hidden': 'true', tabindex: '-1' })
})
