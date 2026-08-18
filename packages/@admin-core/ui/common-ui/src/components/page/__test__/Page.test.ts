// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref, vShow, withDirectives } from 'vue'
import { expect, test } from 'vite-plus/test'
import Page from '../Page.vue'

test('uses the normal page layout by default and renders its slot directly', () => {
  const wrapper = mount(Page, {
    slots: { default: '<p data-testid="content">页面内容</p>' },
  })

  expect(wrapper.classes()).toEqual(['relative', 'min-w-0', 'w-full'])
  expect(wrapper.get('[data-testid="content"]').text()).toBe('页面内容')
})

test('adds the fill-height layout when requested', () => {
  const wrapper = mount(Page, { props: { fillHeight: true } })

  expect(wrapper.classes()).toEqual(['relative', 'min-w-0', 'w-full', 'flex', 'min-h-0', 'flex-1', 'flex-col', 'overflow-hidden'])
})

test('forwards class, style, and v-show attributes to the root element', async () => {
  const visible = ref(false)
  const Host = defineComponent({
    setup() {
      return () => withDirectives(h(Page, { class: 'custom-page', 'data-testid': 'page', style: { color: 'red' } }, { default: () => '内容' }), [[vShow, visible.value]])
    },
  })

  const wrapper = mount(Host)
  const page = wrapper.get('[data-testid="page"]')
  const pageElement = page.element as HTMLElement

  expect(page.classes()).toContain('custom-page')
  expect(page.attributes('style')).toContain('color: red')
  expect(pageElement.style.display).toBe('none')

  visible.value = true
  await nextTick()

  expect(pageElement.style.display).toBe('')
})
