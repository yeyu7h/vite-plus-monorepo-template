// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { nextTick, reactive } from 'vue'
import { expect, test, vi } from 'vite-plus/test'
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
  const pinItem = (menus[0]!.props('items') as { label: string; onSelect: () => void }[][])[0]![1]!
  const unpinItem = (menus[1]!.props('items') as { label: string; onSelect: () => void }[][])[0]![1]!
  expect(pinItem.label).toBe('固定')
  expect(unpinItem.label).toBe('取消固定')
  expect(menus[0]!.props('ui')).toEqual({ content: 'z-50', item: 'items-center', itemLeadingIcon: 'size-3.5' })
  expect(wrapper.findAll('.tab-pin-button, .tab-close-button')).toHaveLength(2)

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
  const label = () => (menu.props('items') as { label: string }[][])[0]![1]!.label

  menu.vm.$emit('update:open', true)
  await nextTick()
  expect(label()).toBe('固定')

  tab.pinned = true
  await nextTick()
  expect(label()).toBe('固定')

  menu.vm.$emit('update:open', false)
  menu.vm.$emit('update:open', true)
  await nextTick()
  expect(label()).toBe('取消固定')
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
  const item = (wrapper.getComponent({ name: 'UContextMenu' }).props('items') as { disabled: boolean; label: string; onSelect: () => void }[][])[0]![1]!

  expect(item).toMatchObject({ disabled: true, label: '取消固定' })
  expect((wrapper.getComponent({ name: 'UContextMenu' }).props('items') as { disabled?: boolean }[][])[2]?.[0]?.disabled).toBe(true)
  expect(wrapper.get('button[aria-label="唯一标签页不可取消固定"]').attributes('disabled')).toBeDefined()
  item.onSelect()
  expect(wrapper.emitted('pin')).toBeUndefined()
})

test('offers close, bulk close, refresh and opening a browser tab for the right-clicked tab', () => {
  const wrapper = mount(Tabs, {
    props: {
      activeKey: '/home',
      tabs: [
        { key: '/home', title: 'Home', to: '/home', pinned: true },
        { key: '/reports', title: 'Reports', to: '/reports' },
        { key: '/settings', title: 'Settings', to: '/settings', closable: false },
        { key: '/logs', title: 'Logs', to: '/logs' },
      ],
    },
    global: { stubs: { UContextMenu: { name: 'UContextMenu', props: ['items'], template: '<slot />' }, UIcon: true } },
  })

  type MenuItem = { label: string; icon?: string; disabled?: boolean; onSelect: () => void }
  const menus = wrapper.findAllComponents({ name: 'UContextMenu' })
  /** 读取指定标签页分组后的右键菜单项
   * @param index 标签页在列表中的位置
   * @returns 该标签页的菜单项分组
   */
  const items = (index: number) => menus[index]!.props('items') as MenuItem[][]
  expect(items(0).map((group) => group.map((item) => item.label))).toEqual([['重新加载', '取消固定'], ['在新标签页打开'], ['关闭', '关闭其他标签页', '关闭右侧标签页']])
  expect(items(0)[1]?.[0]?.icon).toBe('i-lucide-external-link')
  expect(items(0)[2]?.every((item) => item.icon === undefined)).toBe(true)
  expect(items(0)[2]?.[0]?.disabled).toBe(false)
  expect(items(1)[2]?.[0]?.disabled).toBe(false)
  expect(items(2)[2]?.[0]?.disabled).toBe(true)
  expect(items(3)[2]?.[2]?.disabled).toBe(true)
  expect(wrapper.find('[data-tab-key="/home"] .tab-close-button').exists()).toBe(false)

  items(1)[2]![0]!.onSelect()
  items(1)[2]![1]!.onSelect()
  items(1)[2]![2]!.onSelect()
  items(2)[0]![0]!.onSelect()
  items(0)[2]![0]!.onSelect()
  items(3)[2]![2]!.onSelect()
  items(2)[1]![0]!.onSelect()

  expect(wrapper.emitted('close')).toEqual([['/reports'], ['/home']])
  expect(wrapper.emitted('closeOthers')).toEqual([['/reports']])
  expect(wrapper.emitted('closeRight')).toEqual([['/reports']])
  expect(wrapper.emitted('refresh')).toEqual([['/settings']])
  expect(wrapper.emitted('openBrowserTab')).toEqual([['/settings']])
})

test('offers the iframe source separately from the admin route', () => {
  const wrapper = mount(Tabs, {
    props: {
      activeKey: '/reports',
      tabs: [
        { key: '/reports', title: 'Reports', to: '/reports' },
        { key: '/docs', title: 'Docs', to: '/docs', iframeSrc: 'https://example.com/docs' },
      ],
    },
    global: { stubs: { UContextMenu: { name: 'UContextMenu', props: ['items'], template: '<slot />' }, UIcon: true } },
  })

  type MenuItem = { label: string; onSelect: () => void }
  const menus = wrapper.findAllComponents({ name: 'UContextMenu' })
  const reports = menus[0]!.props('items') as MenuItem[][]
  const docs = menus[1]!.props('items') as MenuItem[][]
  expect(reports[1]?.map((item) => item.label)).toEqual(['在新标签页打开'])
  expect(docs[1]?.map((item) => item.label)).toEqual(['在新标签页打开', '在新标签页打开 iframe 链接'])

  docs[1]![0]!.onSelect()
  docs[1]![1]!.onSelect()
  expect(wrapper.emitted('openBrowserTab')).toEqual([['/docs']])
  expect(wrapper.emitted('openIframeSource')).toEqual([['/docs']])
})

test('exposes focusable tab buttons and keeps their actions separate', async () => {
  const wrapper = mount(Tabs, {
    attachTo: document.body,
    props: {
      activeKey: '/home',
      tabs: [
        { key: '/home', title: 'Home', to: '/home', pinned: true },
        { key: '/reports', title: 'Reports', to: '/reports' },
      ],
    },
    global: { stubs: { UContextMenu: { name: 'UContextMenu', props: ['items'], template: '<slot />' }, UIcon: true } },
  })

  try {
    const home = wrapper.get<HTMLButtonElement>('[data-tab-key="/home"] .tab-select-button')
    const reports = wrapper.get<HTMLButtonElement>('[data-tab-key="/reports"] .tab-select-button')
    expect(home.attributes()).toMatchObject({ type: 'button', 'aria-label': 'Home', 'aria-current': 'page' })
    expect(reports.attributes('aria-label')).toBe('Reports')
    expect(reports.attributes('aria-current')).toBeUndefined()
    expect(home.element.tabIndex).toBe(0)
    expect(reports.element.tabIndex).toBe(0)
    expect(wrapper.find('button button').exists()).toBe(false)

    reports.element.focus()
    expect(document.activeElement).toBe(reports.element)
    expect(wrapper.emitted('select')).toBeUndefined()
    await reports.trigger('click')
    expect(wrapper.emitted('select')).toEqual([['/reports']])

    await wrapper.get('.tab-close-button').trigger('click')
    expect(wrapper.emitted('close')).toEqual([['/reports']])
    expect(wrapper.emitted('select')).toHaveLength(1)
  } finally {
    wrapper.unmount()
  }
})

test('previews horizontal reordering and rejects drops across pinned groups', async () => {
  const wrapper = mount(Tabs, {
    props: {
      activeKey: '/ordinary-1',
      tabs: [
        { key: '/pinned-1', title: 'Pinned 1', to: '/pinned-1', pinned: true },
        { key: '/pinned-2', title: 'Pinned 2', to: '/pinned-2', pinned: true },
        { key: '/ordinary-1', title: 'Ordinary 1', to: '/ordinary-1' },
        { key: '/ordinary-2', title: 'Ordinary 2', to: '/ordinary-2', closable: false },
      ],
    },
    global: { stubs: { UContextMenu: { name: 'UContextMenu', props: ['items'], template: '<slot />' }, UIcon: true } },
  })
  vi.spyOn(wrapper.get('.tab-reorder-list').element, 'getBoundingClientRect').mockReturnValue({ left: 0, right: 500, top: 0, bottom: 50 } as DOMRect)
  wrapper.findAll('.tab-slot').forEach((slot, index) => {
    Object.defineProperty(slot.element, 'offsetLeft', { configurable: true, value: index * 100 })
    Object.defineProperty(slot.element, 'offsetWidth', { configurable: true, value: 100 })
    vi.spyOn(slot.get('.tab-item').element, 'getBoundingClientRect').mockReturnValue({ left: index * 100, top: 10, width: 100, height: 40 } as DOMRect)
  })
  const keys = () => wrapper.findAll('.tab-slot').map((slot) => slot.attributes('data-tab-key'))
  const move = (pointerId: number, clientX: number, clientY = 20) => window.dispatchEvent(new PointerEvent('pointermove', { pointerId, clientX, clientY, bubbles: true }))
  const release = (pointerId: number, clientX: number, clientY = 20) => window.dispatchEvent(new PointerEvent('pointerup', { pointerId, clientX, clientY, bubbles: true }))
  const finishLanding = (ghost: HTMLElement | null) => {
    const event = new Event('transitionend', { bubbles: true })
    Object.defineProperty(event, 'propertyName', { value: 'left' })
    ghost?.dispatchEvent(event)
  }

  await wrapper.get('[data-tab-key="/ordinary-1"] .tab-select-button').trigger('pointerdown', { button: 0, pointerId: 1, clientX: 250, clientY: 20 })
  move(1, 390, 90)
  const shield = document.querySelector('.tab-drag-shield')
  expect(shield).not.toBeNull()
  expect((document.querySelector('.tab-drag-ghost') as HTMLElement).inert).toBe(true)
  expect(document.querySelector('.tab-drag-ghost')?.getAttribute('aria-hidden')).toBe('true')
  shield?.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 800, clientY: 90, bubbles: true }))
  expect((document.querySelector('.tab-drag-ghost') as HTMLElement | null)?.style.left).toBe('400px')
  shield?.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: -100, clientY: 90, bubbles: true }))
  expect((document.querySelector('.tab-drag-ghost') as HTMLElement | null)?.style.left).toBe('0px')
  shield?.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 260, clientY: 90, bubbles: true }))
  await nextTick()
  expect(keys()).toEqual(['/pinned-1', '/pinned-2', '/ordinary-1', '/ordinary-2'])
  expect((document.querySelector('.tab-drag-ghost') as HTMLElement | null)?.style.top).toBe('10px')
  release(1, 800, 20)
  await nextTick()
  expect(keys()).toEqual(['/pinned-1', '/pinned-2', '/ordinary-2', '/ordinary-1'])
  expect(wrapper.emitted('reorder')).toEqual([['/ordinary-1', '/ordinary-2', 'after']])
  const lastSlotLanding = document.querySelector('.tab-drag-ghost') as HTMLElement | null
  expect(lastSlotLanding?.style.left).toBe('300px')
  finishLanding(lastSlotLanding)
  expect(document.querySelector('.tab-drag-ghost')).toBeNull()

  await wrapper.get('[data-tab-key="/ordinary-1"] .tab-item').trigger('pointerdown', { button: 0, pointerId: 2, clientX: 250, clientY: 20 })
  move(2, 390)
  await nextTick()
  expect(keys()).toEqual(['/pinned-1', '/pinned-2', '/ordinary-2', '/ordinary-1'])
  move(2, 50)
  await nextTick()
  expect(keys()).toEqual(['/pinned-1', '/pinned-2', '/ordinary-1', '/ordinary-2'])
  release(2, 50)
  expect(wrapper.emitted('reorder')).toHaveLength(1)
  const returningGhost = document.querySelector('.tab-drag-ghost') as HTMLElement | null
  expect(returningGhost?.style.left).toBe('200px')
  expect(document.querySelector('.tab-drag-shield')).toBeNull()
  finishLanding(returningGhost)
  expect(document.querySelector('.tab-drag-ghost')).toBeNull()

  await wrapper.get('[data-tab-key="/pinned-2"] .tab-item').trigger('pointerdown', { button: 0, pointerId: 3, clientX: 150, clientY: 20 })
  move(3, 250)
  release(3, 250)
  expect(wrapper.emitted('reorder')).toHaveLength(1)
  const pinnedReturn = document.querySelector('.tab-drag-ghost') as HTMLElement | null
  expect(pinnedReturn?.style.left).toBe('100px')
  finishLanding(pinnedReturn)

  await wrapper.get('[data-tab-key="/pinned-2"] .tab-item').trigger('pointerdown', { button: 0, pointerId: 4, clientX: 150, clientY: 20 })
  move(4, 80)
  await nextTick()
  expect(keys()).toEqual(['/pinned-2', '/pinned-1', '/ordinary-1', '/ordinary-2'])
  release(4, 80)
  expect(wrapper.emitted('reorder')?.[1]).toEqual(['/pinned-2', '/pinned-1', 'before'])
  const firstSlotLanding = document.querySelector('.tab-drag-ghost') as HTMLElement | null
  expect(firstSlotLanding?.style.left).toBe('0px')
  finishLanding(firstSlotLanding)
  await wrapper.get('[data-tab-key="/pinned-2"] .tab-select-button').trigger('click')
  expect(wrapper.emitted('select')).toBeUndefined()

  await wrapper.get('[data-tab-key="/pinned-1"] .tab-pin-button').trigger('pointerdown', { button: 0, pointerId: 5, clientX: 50, clientY: 20 })
  move(5, 120)
  expect(document.querySelector('.tab-drag-ghost')).toBeNull()
  expect(wrapper.emitted('reorder')).toHaveLength(2)

  await wrapper.get('[data-tab-key="/ordinary-1"] .tab-item').trigger('pointerdown', { button: 0, pointerId: 6, clientX: 250, clientY: 20 })
  move(6, 254, 120)
  release(6, 254, 120)
  expect(document.querySelector('.tab-drag-ghost')).toBeNull()
  expect(wrapper.emitted('reorder')).toHaveLength(2)

  await wrapper.get('[data-tab-key="/ordinary-1"] .tab-item').trigger('pointerdown', { button: 0, pointerId: 7, clientX: 250, clientY: 20 })
  move(7, 265)
  release(7, 265)
  const unchangedReturn = document.querySelector('.tab-drag-ghost') as HTMLElement | null
  expect(unchangedReturn?.style.left).toBe('200px')
  finishLanding(unchangedReturn)
  expect(wrapper.emitted('reorder')).toHaveLength(2)
  wrapper.unmount()
})
