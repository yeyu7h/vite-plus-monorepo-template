// @vitest-environment happy-dom

import { shallowMount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { beforeEach, expect, test } from 'vite-plus/test'
import Layout from './Layout.vue'

beforeEach(() => {
  document.documentElement.scrollTop = 0
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 })
})

test('adds header elevation only after the document content has scrolled', async () => {
  const wrapper = shallowMount(Layout, {
    props: { tabbarEnable: false },
  })
  const header = wrapper.get('[data-layout-header-wrapper]')

  expect(header.classes()).not.toContain('shadow-[0_16px_24px_var(--ui-bg)]')

  document.documentElement.scrollTop = 21
  document.dispatchEvent(new Event('scroll'))
  await nextTick()

  expect(header.classes()).toContain('shadow-[0_16px_24px_var(--ui-bg)]')

  document.documentElement.scrollTop = 0
  document.dispatchEvent(new Event('scroll'))
  await nextTick()

  expect(header.classes()).not.toContain('shadow-[0_16px_24px_var(--ui-bg)]')
  wrapper.unmount()
})
