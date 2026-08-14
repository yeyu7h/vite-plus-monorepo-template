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

const PersistentCollapsibleStub = defineComponent({
  props: {
    open: Boolean,
  },
  setup(props, { slots }) {
    return () => h('div', [slots.default?.({ open: props.open }), slots.content?.()])
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
  for (const content of wrapper.findAll('[data-menu-children]')) {
    expect(content.classes()).toEqual(expect.arrayContaining(['animate-[fade-in_150ms_ease-out]', 'opacity-100']))
  }
})

test('animates the trailing chevron when a directory expands', async () => {
  const wrapper = mountMenuList([directory('/system', '系统', '设置')])
  const chevron = wrapper.get('u-icon-stub[name="i-lucide-chevron-down"]')

  expect(chevron.classes()).toEqual(expect.arrayContaining(['size-4', 'transition-transform', 'duration-200', 'ease-out']))
  expect(chevron.element.parentElement?.classList.contains('ms-auto')).toBe(true)
  expect(chevron.element.parentElement?.classList.contains('w-4')).toBe(true)
  expect(chevron.attributes('style')).toContain('rotate(-90deg)')

  await buttonByText(wrapper, '系统').trigger('click')

  expect(chevron.attributes('style')).toContain('rotate(0deg)')
})

test('renders the external-link icon at the upper-right of the label', () => {
  const wrapper = mountMenuList([{ externalLink: 'https://example.com', id: '/external', path: '/external', title: '这是一个很长的外部链接菜单名称' }])
  const link = wrapper.get('a[target="_blank"]')
  const label = link.get('[data-menu-external-label]')
  const content = label.get('[data-menu-external-content]')
  const text = content.get('[data-menu-label-text]')
  const externalIcon = link.get('u-icon-stub[name="i-lucide-arrow-up-right"]')

  expect(content.classes()).toEqual(expect.arrayContaining(['inline-flex', 'max-w-full', 'min-w-0', 'items-start']))
  expect(text.classes()).toEqual(expect.arrayContaining(['min-w-0', 'truncate']))
  expect(externalIcon.element.parentElement).toBe(content.element)
  expect(externalIcon.classes()).toEqual(expect.arrayContaining(['ms-0.5', 'size-3', 'shrink-0', 'text-dimmed']))
  expect(link.find('u-icon-stub[name="i-lucide-external-link"]').exists()).toBe(false)
})

test('limits a collapsed active leaf background to the icon area', async () => {
  const collapsed = ref(true)
  const items: AdminMenuItem[] = [{ active: true, icon: 'i-lucide-file', id: '/active', path: '/active', title: '当前菜单' }]
  const wrapper = mount(
    defineComponent({
      setup: () => () => h(LayoutMenuList, { collapsed: collapsed.value, items }),
    }),
    { global: { stubs: menuStubs } },
  )
  const link = wrapper.get('a[title="当前菜单"]')
  const icon = link.get('u-icon-stub[name="i-lucide-file"]')

  expect(link.classes()).toEqual(expect.arrayContaining(['isolate', 'w-full', 'before:z-0', 'before:size-8', 'before:rounded-md', 'before:bg-elevated']))
  expect(link.classes()).not.toContain('bg-elevated')
  expect(icon.classes()).toEqual(expect.arrayContaining(['relative', 'z-10']))

  collapsed.value = false
  await nextTick()

  expect(link.classes()).toContain('bg-elevated')
  expect(link.classes()).not.toContain('before:size-8')
})

test('keeps a root icon at the same horizontal position while expanding and collapsing', async () => {
  const collapsed = ref(true)
  const items: AdminMenuItem[] = [{ icon: 'i-lucide-file', id: '/item', path: '/item', title: '菜单' }]
  const wrapper = mount(
    defineComponent({
      setup: () => () => h(LayoutMenuList, { collapsed: collapsed.value, items }),
    }),
    { global: { stubs: menuStubs } },
  )
  const link = wrapper.get('a[title="菜单"]')

  expect(link.classes()).toContain('px-1.5')
  expect(link.classes()).not.toContain('justify-center')

  collapsed.value = false
  await nextTick()

  expect(link.classes()).toContain('pl-1.5')
  expect(link.classes()).not.toContain('justify-center')

  collapsed.value = true
  await nextTick()

  expect(link.classes()).toContain('px-1.5')
  expect(link.classes()).not.toContain('justify-center')
})

test('fades nested menu content while the sidebar collapses', () => {
  const wrapper = mount(LayoutMenuList, {
    props: {
      collapsed: true,
      items: [directory('/system', '系统', '设置', true)],
    },
    global: {
      stubs: {
        ...menuStubs,
        UCollapsible: PersistentCollapsibleStub,
      },
    },
  })
  const content = wrapper.get('[data-menu-children]')

  expect(content.classes()).toEqual(expect.arrayContaining(['animate-[fade-out_150ms_ease-out]', 'opacity-0']))
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
  expect(buttonByText(wrapper, '二级').classes()).toEqual(expect.arrayContaining(['gap-1.5', 'py-1.5', 'pl-2.5', 'text-sm', 'font-medium']))
  expect(buttonByText(wrapper, '二级').classes()).not.toContain('min-h-9')
  expect(buttonByText(wrapper, '二级').classes()).not.toContain('py-2')
  expect(linkByText(wrapper, '三级').classes()).toContain('pl-2.75')
  expect(wrapper.findAll('ul')).toHaveLength(3)
  for (const list of wrapper.findAll('ul')) {
    expect(list.classes()).toContain('space-y-1')
  }
  expect(wrapper.findAll('.border-l')).toHaveLength(2)
  const guides = wrapper.findAll('.border-l')
  expect(guides[0]!.classes()).toContain('ml-4')
  expect(guides[1]!.classes()).toContain('ml-5')
  for (const guide of guides) {
    expect(guide.classes()).toEqual(expect.arrayContaining(['border-default', 'pl-1.25']))
    expect(guide.classes()).not.toContain('border-muted')
    expect(guide.classes()).not.toContain('pt-1')
    expect(guide.element.parentElement?.classList.contains('pt-1')).toBe(true)
  }
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

test('keeps opened branches when selecting an external link', async () => {
  const wrapper = mountMenuList([directory('/first', '第一个目录', '第一个子菜单'), { externalLink: 'https://example.com', id: '/external', path: '/external', title: '外部链接' }])

  await buttonByText(wrapper, '第一个目录').trigger('click')
  await linkByText(wrapper, '外部链接').trigger('click')

  expect(wrapper.text()).toContain('第一个子菜单')
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
  expect(buttonByText(wrapper, '第二个目录').classes()).toContain('hover:bg-elevated/50')
  expect(wrapper.get('a').classes()).toContain('bg-elevated')
})
