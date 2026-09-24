// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { nextTick, reactive } from 'vue'
import { expect, test } from 'vite-plus/test'
import Tabs from './Tabs.vue'

test('offers pin and unpin from each tab context menu and the pinned icon', async () => {
  const wrapper = mount(Tabs, {
    props: {
      activeKey: '/home',
      tabs: [
        { key: '/home', title: 'Home', to: '/home' },
        { key: '/reports', title: 'Reports', to: '/reports', pinned: true },
      ],
    },
    global: {
      stubs: {
        UContextMenu: { name: 'UContextMenu', props: ['items', 'ui'], template: '<slot />' },
        UIcon: true,
      },
    },
  })

  const menus = wrapper.findAllComponents({ name: 'UContextMenu' })
  const pinItem = (menus[0]!.props('items') as { label: string; onSelect: () => void }[])[0]!
  const unpinItem = (menus[1]!.props('items') as { label: string; onSelect: () => void }[])[0]!
  expect(pinItem.label).toBe('固定标签页')
  expect(unpinItem.label).toBe('取消固定标签页')
  expect(menus[0]!.props('ui')).toEqual({ content: 'z-50', itemLeadingIcon: 'size-3.5' })
  expect(wrapper.findAll('button')).toHaveLength(2)

  await wrapper.get('button[aria-label="取消固定标签页"]').trigger('click')

  pinItem.onSelect()
  unpinItem.onSelect()
  expect(wrapper.emitted('pin')).toEqual([
    ['/reports', false],
    ['/home', true],
    ['/reports', false],
  ])
})

test('keeps the context menu label unchanged until the next opening', async () => {
  const tab = reactive({ key: '/home', title: 'Home', to: '/home', pinned: false })
  const wrapper = mount(Tabs, {
    props: { activeKey: '/home', tabs: [tab, { key: '/reports', title: 'Reports', to: '/reports' }] },
    global: {
      stubs: {
        UContextMenu: { name: 'UContextMenu', props: ['items'], template: '<slot />' },
        UIcon: true,
      },
    },
  })
  const menu = wrapper.findAllComponents({ name: 'UContextMenu' })[0]!
  const label = () => (menu.props('items') as { label: string }[])[0]!.label

  menu.vm.$emit('update:open', true)
  await nextTick()
  expect(label()).toBe('固定标签页')

  tab.pinned = true
  await nextTick()
  expect(label()).toBe('固定标签页')

  menu.vm.$emit('update:open', false)
  menu.vm.$emit('update:open', true)
  await nextTick()
  expect(label()).toBe('取消固定标签页')
})

test('shows a disabled pin on the only tab and blocks the context menu action', () => {
  const wrapper = mount(Tabs, {
    props: { activeKey: '/home', tabs: [{ key: '/home', title: 'Home', to: '/home' }] },
    global: {
      stubs: {
        UContextMenu: { name: 'UContextMenu', props: ['items'], template: '<slot />' },
        UIcon: true,
      },
    },
  })
  const item = (wrapper.getComponent({ name: 'UContextMenu' }).props('items') as { disabled: boolean; label: string; onSelect: () => void }[])[0]!

  expect(item).toMatchObject({ disabled: true, label: '取消固定标签页' })
  expect(wrapper.get('button[aria-label="唯一标签页不可取消固定"]').attributes('disabled')).toBeDefined()
  item.onSelect()
  expect(wrapper.emitted('pin')).toBeUndefined()
})
