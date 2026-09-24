import { describe, expect, test } from 'vite-plus/test'
import { watch } from 'vue'

import { useFormEditor } from './useFormEditor'

describe('useFormEditor', () => {
  test('reopens with fresh values and a new form key without mutating the source record', () => {
    type Item = { name: string; roles: string[] }
    const editor = useFormEditor({ toForm: (item?: Item) => ({ name: item?.name ?? '', roles: [...(item?.roles ?? [])] }) })
    const record = { name: 'Alice', roles: ['reader'] }
    const state = editor.form
    editor.openEditor(record)
    const previousKey = editor.formKey.value
    editor.form.name = 'Changed'
    editor.form.roles.push('editor')
    expect(record).toEqual({ name: 'Alice', roles: ['reader'] })

    editor.close()
    expect(editor.open.value).toBe(false)
    expect(editor.form.name).toBe('Changed')
    editor.openEditor()
    expect(editor.form).toBe(state)
    expect(editor.form).toEqual({ name: '', roles: [] })
    expect(editor.editing.value).toBeNull()
    expect(editor.isEditing.value).toBe(false)
    expect(editor.formKey.value).toBeGreaterThan(previousKey)
    editor.openEditor(record)
    expect(editor.form).toEqual(record)
    expect(editor.isEditing.value).toBe(true)
  })

  test('removes optional fields left over from the previous record', () => {
    type State = { name: string; description?: string }
    const editor = useFormEditor({ toForm: (item?: State): State => ({ ...(item ?? { name: '' }) }) })
    editor.openEditor({ name: 'First', description: 'optional' })
    editor.openEditor({ name: 'Second' })
    expect(Object.hasOwn(editor.form, 'description')).toBe(false)
  })

  test('distinguishes record hydration from user changes in synchronous field watchers', () => {
    type State = { value: string; type: string }
    const editor = useFormEditor({ toForm: (item?: State) => ({ ...(item ?? { value: '', type: 'STRING' }) }) })
    const stop = watch(
      () => editor.form.type,
      () => {
        if (!editor.hydrating.value) editor.form.value = 'default'
      },
      { flush: 'sync' },
    )
    try {
      editor.openEditor({ value: '{"keep":true}', type: 'JSON' })
      expect(editor.form.value).toBe('{"keep":true}')
      expect(editor.hydrating.value).toBe(false)
      editor.form.type = 'BOOLEAN'
      expect(editor.form.value).toBe('default')
    } finally {
      stop()
    }
  })
})
