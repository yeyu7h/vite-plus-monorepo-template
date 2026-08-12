// @vitest-environment happy-dom

import type { AdminMenuGroup } from '@monorepo-admin-core/types'
import { mount } from '@vue/test-utils'
import { expect, test } from 'vite-plus/test'
import { defineComponent, h, nextTick, ref } from 'vue'
import LayoutMenu from './Menu.vue'

const RouterLinkStub = defineComponent({
  props: { to: String },
  setup(props, { attrs, slots }) {
    return () => h('a', { ...attrs, href: props.to }, slots.default?.())
  },
})

const UCollapsibleStub = defineComponent({
  props: { open: Boolean },
  emits: ['update:open'],
  setup(props, { slots }) {
    return () => h('div', [slots.default?.({ open: props.open }), props.open ? slots.content?.() : undefined])
  },
})

const groups: AdminMenuGroup[] = [
  {
    id: 'main',
    label: '主菜单',
    children: [
      {
        active: true,
        id: '/system',
        icon: 'i-lucide-settings',
        path: '/system/settings',
        title: '系统',
        children: [{ active: true, id: '/system/settings', icon: 'i-lucide-sliders', path: '/system/settings', title: '设置' }],
      },
      { id: '/docs', icon: 'i-lucide-book-open', path: '/docs', title: '文档' },
    ],
  },
  {
    id: 'links',
    label: '相关链接',
    children: [{ id: '/help', icon: 'i-lucide-circle-help', path: '/help', title: '帮助' }],
  },
]

test('animates the same navigation tree between collapsed icons and the full menu', async () => {
  const opened = ref(false)
  const wrapper = mount(
    defineComponent({
      setup: () => () => h(LayoutMenu, { collapsed: true, groups, opened: opened.value }),
    }),
    {
      global: {
        stubs: {
          RouterLink: RouterLinkStub,
          UCollapsible: UCollapsibleStub,
          UIcon: true,
        },
      },
    },
  )
  const navigation = wrapper.get('[data-menu-mode="single"]')
  const navigationElement = navigation.element
  const rootDirectory = navigation.get('button[title="系统"]')
  const rootLeaf = navigation.get('a[title="文档"]')
  const rootDirectoryChevron = rootDirectory.get('u-icon-stub[name="i-lucide-chevron-down"]')

  expect(wrapper.findAll('nav')).toHaveLength(1)
  expect(navigation.findAll('section')).toHaveLength(2)
  expect(navigation.get('[data-menu-separator]').classes()).toEqual(expect.arrayContaining(['border-t', 'border-default', 'w-6']))
  expect(navigation.get('[data-menu-separator]').classes()).toContain('ms-1')
  expect(navigation.get('[data-menu-separator]').classes()).not.toContain('border-muted')
  expect(navigation.get('[data-menu-separator]').classes()).not.toContain('mx-auto')
  expect(rootDirectory.classes()).toEqual(expect.arrayContaining(['px-1.5', 'py-1.5', 'text-sm', 'font-medium']))
  expect(rootDirectory.classes()).not.toContain('justify-center')
  expect(rootDirectory.classes()).not.toContain('min-h-9')
  expect(rootDirectory.classes()).not.toContain('py-2')
  expect(rootDirectory.classes()).toEqual(expect.arrayContaining(['before:size-8', 'before:rounded-md', 'before:bg-elevated']))
  expect(rootDirectory.classes()).not.toContain('bg-elevated')
  expect(rootDirectory.get('span').classes()).toContain('max-w-0')
  expect(rootLeaf.get('span').classes()).toContain('max-w-0')
  expect(rootDirectoryChevron.element.parentElement?.classList.contains('ms-auto')).toBe(false)
  expect(rootDirectoryChevron.element.parentElement?.classList.contains('w-0')).toBe(true)
  expect(navigation.find('a[href="/system/settings"]').exists()).toBe(false)
  expect(wrapper.find('u-navigation-menu-stub').exists()).toBe(false)

  opened.value = true
  await nextTick()
  expect(wrapper.get('[data-menu-mode="single"]').element).toBe(navigationElement)
  expect(rootDirectory.classes()).toContain('gap-1.5')
  expect(rootDirectory.classes()).toContain('hover:bg-elevated/50')
  expect(rootDirectory.classes()).not.toContain('before:size-8')
  expect(rootDirectory.classes()).not.toContain('bg-elevated')
  expect(rootDirectory.get('span').classes()).toContain('max-w-40')
  expect(rootDirectoryChevron.element.parentElement?.classList.contains('ms-auto')).toBe(true)
  expect(rootDirectoryChevron.element.parentElement?.classList.contains('w-4')).toBe(true)
  expect(navigation.get('[data-menu-separator]').classes()).toContain('w-[calc(100%-0.25rem)]')
  expect(navigation.find('a[href="/system/settings"]').exists()).toBe(true)
  expect(navigation.text()).toContain('设置')
})
