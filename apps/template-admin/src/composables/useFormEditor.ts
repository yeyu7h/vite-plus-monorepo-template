import { computed, reactive, readonly, ref, shallowRef } from 'vue'

export interface FormEditorOptions<Item, State extends object> {
  /** Return fresh objects/arrays so form edits never mutate query data. */
  toForm: (item?: Item) => State
}

export function useFormEditor<Item, State extends object>(options: FormEditorOptions<Item, State>) {
  const open = ref(false)
  const editing = shallowRef<Item | null>(null)
  const form = reactive(options.toForm())
  const formKey = ref(0)
  const hydrating = ref(false)

  function hydrate(next: State) {
    hydrating.value = true
    try {
      for (const key of Object.keys(form)) {
        if (!Object.hasOwn(next, key)) Reflect.deleteProperty(form, key)
      }
      Object.assign(form, next)
      // Remount UForm to clear validation errors when changing records.
      formKey.value += 1
    } finally {
      hydrating.value = false
    }
  }

  function openEditor(item?: Item) {
    editing.value = item ?? null
    hydrate(options.toForm(item))
    open.value = true
  }

  function close() {
    // Keep the state intact while the closing transition runs.
    open.value = false
  }

  return {
    open,
    editing: readonly(editing),
    form,
    formKey: readonly(formKey),
    hydrating: readonly(hydrating),
    isEditing: computed(() => editing.value !== null),
    hydrate,
    openEditor,
    close,
  }
}
