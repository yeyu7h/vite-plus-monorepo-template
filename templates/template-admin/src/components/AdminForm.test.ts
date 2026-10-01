// @vitest-environment happy-dom
import { afterEach, describe, expect, test } from 'vite-plus/test'
import { createApp, h, nextTick, reactive, ref } from 'vue'
import type { Component } from 'vue'
import NuxtUI from '@nuxt/ui/vue-plugin'
import { z } from 'zod'

import AdminForm from './AdminForm.vue'

const mounted: Array<() => void> = []
afterEach(() => mounted.splice(0).forEach((unmount) => unmount()))

describe('AdminForm', () => {
  test('renders configured fields and validates the current state', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const state = reactive({ name: '', extra: 'kept' })
    const form = ref<{ validate: () => Promise<unknown> } | null>(null)
    const app = createApp({
      setup: () => () =>
        h(AdminForm as Component, {
          ref: form,
          state,
          config: {
            schema: z.object({
              name: z
                .string()
                .min(1)
                .transform((value) => value.toUpperCase()),
            }),
            fields: [{ name: 'name', label: '名称' }],
          },
        }),
    })
    app.use(NuxtUI)
    app.mount(host)
    mounted.push(() => {
      app.unmount()
      host.remove()
    })
    await nextTick()

    const input = host.querySelector('input')
    expect(input).not.toBeNull()
    expect(await form.value?.validate()).toBe(false)
    input!.value = 'Alice'
    input!.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
    expect(state.name).toBe('Alice')
    expect(state.extra).toBe('kept')
    expect(await form.value?.validate()).toEqual({ name: 'ALICE' })
  })

  test('changes visible fields and validation together', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const state = reactive({ name: 'Alice', password: '' })
    const editing = ref(false)
    const form = ref<{ validate: () => Promise<unknown> } | null>(null)
    const createSchema = z.object({ name: z.string().min(1), password: z.string().min(1) })
    const editSchema = z.object({ name: z.string().min(1) })
    const app = createApp({
      setup: () => () =>
        h(AdminForm as Component, {
          ref: form,
          state,
          config: editing.value ? { schema: editSchema, fields: [{ name: 'name' }] } : { schema: createSchema, fields: [{ name: 'name' }, { name: 'password' }] },
        }),
    })
    app.use(NuxtUI)
    app.mount(host)
    mounted.push(() => {
      app.unmount()
      host.remove()
    })
    await nextTick()

    expect(host.querySelectorAll('input')).toHaveLength(2)
    expect(await form.value?.validate()).toBe(false)
    editing.value = true
    await nextTick()
    expect(host.querySelectorAll('input')).toHaveLength(1)
    expect(await form.value?.validate()).toEqual({ name: 'Alice' })
  })

  test('supports a custom field, leading content, and cross-field validation', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const state = reactive({ valueType: 'NUMBER', value: 'invalid' })
    const form = ref<{ validate: () => Promise<unknown> } | null>(null)
    const schema = z.object({ valueType: z.string(), value: z.string() }).superRefine((data, context) => {
      if (data.valueType === 'NUMBER' && !Number.isFinite(Number(data.value))) {
        context.addIssue({ code: 'custom', path: ['value'], message: '请输入数字' })
      }
    })
    const app = createApp({
      setup: () => () =>
        h(
          AdminForm as Component,
          {
            ref: form,
            state,
            config: { schema, fields: [{ name: 'value', label: '参数值', component: 'slot' }] },
          },
          {
            leading: () => h('p', '配置提示'),
            value: () =>
              h('input', {
                value: state.value,
                onInput: (event: Event) => {
                  state.value = (event.target as HTMLInputElement).value
                },
              }),
          },
        ),
    })
    app.use(NuxtUI)
    app.mount(host)
    mounted.push(() => {
      app.unmount()
      host.remove()
    })
    await nextTick()

    expect(host.textContent).toContain('配置提示')
    expect(await form.value?.validate()).toBe(false)
    const input = host.querySelector('input')!
    input.value = '42'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
    expect(await form.value?.validate()).toEqual({ valueType: 'NUMBER', value: '42' })
  })
})
