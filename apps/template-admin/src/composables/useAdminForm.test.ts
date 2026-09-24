import { describe, expect, test, vi } from 'vite-plus/test'
import { computed, reactive, ref } from 'vue'
import { z } from 'zod'

import { useAdminForm } from './useAdminForm'

describe('useAdminForm', () => {
  test('keeps fields and validation schema together while modes change', () => {
    const state = reactive({ name: '', password: '', tags: [] as string[] })
    const editing = ref(false)
    const createSchema = z.object({ name: z.string().min(1), password: z.string().min(1) })
    const editSchema = z.object({ name: z.string().min(1) })
    const createFields = [{ name: 'name' as const }, { name: 'password' as const }]
    const editFields = [{ name: 'name' as const }]
    const source = computed(() => (editing.value ? { schema: editSchema, fields: editFields } : { schema: createSchema, fields: createFields }))
    const form = useAdminForm({ state, initialValues: () => ({ name: '', password: '', tags: [] }), config: source })

    expect(form.formProps.value.config.schema).toBe(createSchema)
    expect(form.formProps.value.config.fields.map((field) => field.name)).toEqual(['name', 'password'])
    editing.value = true
    expect(form.formProps.value.config.schema).toBe(editSchema)
    expect(form.formProps.value.config.fields.map((field) => field.name)).toEqual(['name'])

    form.setConfig({ schema: createSchema, fields: createFields })
    expect(form.formProps.value.config.schema).toBe(createSchema)
    form.resetConfig()
    expect(form.formProps.value.config.schema).toBe(editSchema)
    expect(form.formProps.value.config.fields.map((field) => field.name)).toEqual(['name'])
  })

  test('copies values, resets state, and delegates typed validation and submission', async () => {
    const state = reactive({ name: '', tags: [] as string[] })
    const schema = z.object({
      name: z
        .string()
        .min(1)
        .transform((value) => value.length),
    })
    const form = useAdminForm({
      state,
      initialValues: () => ({ name: '', tags: [] }),
      config: { schema, fields: [{ name: 'name' }] },
    })
    const supplied = { tags: ['reader'] }
    form.setValues(supplied)
    supplied.tags.push('admin')
    expect(state.tags).toEqual(['reader'])
    const values = form.getValues()
    values.tags.push('changed')
    expect(state.tags).toEqual(['reader'])

    const submit = vi.fn<() => Promise<void>>(async () => {})
    const clear = vi.fn<(name?: string | RegExp) => void>()
    form.formRef.value = {
      validate: async () => ({ name: 5 }),
      submit,
      clear,
      setErrors: vi.fn<(errors: Array<{ name?: string; message: string }>) => void>(),
      getErrors: vi.fn<() => Array<{ name?: string; message: string }>>(() => []),
    }
    const validated = await form.validate()
    expect(validated).toEqual({ name: 5 })
    if (!validated) throw new Error('Expected valid form output')
    const length: number = validated.name
    expect(length).toBe(5)
    await form.submitForm()
    expect(submit).toHaveBeenCalledOnce()
    form.clearValidate('name')
    expect(clear).toHaveBeenCalledWith('name')
    form.resetForm()
    expect(state).toEqual({ name: '', tags: [] })
    expect(clear).toHaveBeenCalledWith()
  })
})
