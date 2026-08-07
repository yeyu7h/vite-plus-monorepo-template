// @vitest-environment happy-dom

import type { AdminMenuItem } from '@monorepo-admin-core/types'
import type { VueWrapper } from '@vue/test-utils'
import { mount } from '@vue/test-utils'
import { expect, test } from 'vite-plus/test'
import { defineComponent, h, nextTick, ref } from 'vue'
import LayoutMenuList from './MenuList.vue'

const UCollapsibleStub = defineComponent({
  props: {
    open: Boolean,
  },
  emits: ['update:open'],
  setup(props, { emit, slots }) {
    return () => h('div', [h('div', { onClick: () => emit('update:open', !props.open) }, slots.default?.({ open: props.open })), props.open ? slots.content?.() : undefined])
  },
})

const RouterLinkStub = defineComponent({
  props: {
    to: String,
  },
  setup(props, { attrs, slots }) {
    return () => h('a', { ...attrs, href: props.to }, slots.default?.())
  },
})

const menuStubs = {
  RouterLink: RouterLinkStub,
  UCollapsible: UCollapsibleStub,
  UIcon: true,
}

function directory(id: string, title: string, childTitle: string, active = false): AdminMenuItem {
  return {
    active,
    id,
    path: `${id}/child`,
    title,
    children: [{ active, id: `${id}/child`, path: `${id}/child`, title: childTitle }],
  }
}

function mountMenuList(items: AdminMenuItem[]) {
  return mount(LayoutMenuList, {
    props: { items },
    global: {
      stubs: menuStubs,
    },
  })
}

function buttonByText(wrapper: VueWrapper, text: string) {
  return wrapper.findAll('button').find((button) => button.text().includes(text))!
}

function linkByText(wrapper: VueWrapper, text: string) {
  return wrapper.findAll('a').find((link) => link.text().includes(text))!
}

test('opens second and third menu levels independently', async () => {
  const items: AdminMenuItem[] = [
    {
      id: '/system',
      path: '/system/settings/level-three',
      title: '系统',
      children: [
        {
          id: '/system/settings',
          path: '/system/settings/level-three',
          title: '设置中心',
          children: [{ id: '/system/settings/level-three', path: '/system/settings/level-three', title: '三级菜单示例' }],
        },
      ],
    },
  ]
  const wrapper = mountMenuList(items)

  await buttonByText(wrapper, '系统').trigger('click')
  await buttonByText(wrapper, '设置中心').trigger('click')

  expect(wrapper.text()).toContain('三级菜单示例')
  expect(wrapper.get('a').attributes('href')).toBe('/system/settings/level-three')
})

test('renders icons on the first two levels but not on the third level', async () => {
  const wrapper = mountMenuList([
    {
      id: '/one',
      icon: 'i-lucide-circle-1',
      path: '/one/two/three',
      title: '一级',
      children: [
        {
          id: '/one/two',
          icon: 'i-lucide-circle-2',
          path: '/one/two/three',
          title: '二级',
          children: [{ id: '/one/two/three', icon: 'i-lucide-circle-3', path: '/one/two/three', title: '三级' }],
        },
      ],
    },
  ])

  await buttonByText(wrapper, '一级').trigger('click')
  await buttonByText(wrapper, '二级').trigger('click')

  expect(wrapper.find('u-icon-stub[name="i-lucide-circle-1"]').exists()).toBe(true)
  expect(wrapper.find('u-icon-stub[name="i-lucide-circle-2"]').exists()).toBe(true)
  expect(wrapper.find('u-icon-stub[name="i-lucide-circle-3"]').exists()).toBe(false)
  expect(buttonByText(wrapper, '二级').classes()).toContain('pl-2.5')
  expect(linkByText(wrapper, '三级').classes()).toContain('pl-[13px]')
})

test('keeps previously opened siblings when expanding another directory', async () => {
  const wrapper = mountMenuList([directory('/first', '第一个目录', '第一个子菜单'), directory('/second', '第二个目录', '第二个子菜单')])

  await buttonByText(wrapper, '第一个目录').trigger('click')
  expect(wrapper.text()).toContain('第一个子菜单')

  await buttonByText(wrapper, '第二个目录').trigger('click')
  expect(wrapper.text()).toContain('第一个子菜单')
  expect(wrapper.text()).toContain('第二个子菜单')
})

test('closes all opened siblings when selecting a leaf item', async () => {
  const wrapper = mountMenuList([directory('/first', '第一个目录', '第一个子菜单'), directory('/second', '第二个目录', '第二个子菜单'), { id: '/standalone', path: '/standalone', title: '独立菜单' }])

  await buttonByText(wrapper, '第一个目录').trigger('click')
  await buttonByText(wrapper, '第二个目录').trigger('click')
  expect(wrapper.text()).toContain('第一个子菜单')
  expect(wrapper.text()).toContain('第二个子菜单')

  await linkByText(wrapper, '独立菜单').trigger('click')
  expect(wrapper.text()).not.toContain('第一个子菜单')
  expect(wrapper.text()).not.toContain('第二个子菜单')
})

test('collapses every other branch while keeping the selected leaf ancestor open', async () => {
  const wrapper = mountMenuList([directory('/first', '第一个目录', '第一个子菜单'), directory('/second', '第二个目录', '第二个子菜单')])

  await buttonByText(wrapper, '第一个目录').trigger('click')
  await buttonByText(wrapper, '第二个目录').trigger('click')
  await linkByText(wrapper, '第一个子菜单').trigger('click')

  expect(wrapper.text()).toContain('第一个子菜单')
  expect(wrapper.text()).not.toContain('第二个子菜单')
})

test('syncs opened branches when navigation changes without clicking a menu item', async () => {
  const first = directory('/first', '第一个目录', '第一个子菜单')
  const second = directory('/second', '第二个目录', '第二个子菜单')
  const items = ref<AdminMenuItem[]>([first, second, { id: '/standalone', path: '/standalone', title: '独立菜单' }])
  const wrapper = mount(
    defineComponent({
      setup: () => () => h(LayoutMenuList, { items: items.value }),
    }),
    { global: { stubs: menuStubs } },
  )

  await buttonByText(wrapper, '第一个目录').trigger('click')
  await buttonByText(wrapper, '第二个目录').trigger('click')
  expect(wrapper.text()).toContain('第一个子菜单')
  expect(wrapper.text()).toContain('第二个子菜单')

  items.value = [directory('/first', '第一个目录', '第一个子菜单', true), second, { id: '/standalone', path: '/standalone', title: '独立菜单' }]
  await nextTick()
  expect(wrapper.text()).toContain('第一个子菜单')
  expect(wrapper.text()).not.toContain('第二个子菜单')

  items.value = [first, second, { active: true, id: '/standalone', path: '/standalone', title: '独立菜单' }]
  await nextTick()
  expect(wrapper.text()).not.toContain('第一个子菜单')
  expect(wrapper.text()).not.toContain('第二个子菜单')
})

test('opens the active sibling and its active descendants initially', () => {
  const wrapper = mountMenuList([directory('/first', '第一个目录', '第一个子菜单'), directory('/second', '第二个目录', '第二个子菜单', true)])

  expect(wrapper.text()).not.toContain('第一个子菜单')
  expect(wrapper.text()).toContain('第二个子菜单')
  expect(buttonByText(wrapper, '第二个目录').classes()).not.toContain('bg-elevated')
  expect(buttonByText(wrapper, '第二个目录').classes()).toContain('text-primary')
  expect(wrapper.get('a').classes()).toContain('bg-elevated')
})
