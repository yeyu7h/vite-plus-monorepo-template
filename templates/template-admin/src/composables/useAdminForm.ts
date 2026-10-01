import type { FormError } from '@nuxt/ui'
import { computed, nextTick, shallowRef, toRaw, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import type { z } from 'zod'

import type { AdminFormConfig, AdminFormSchema } from '@/components/admin-form'

interface AdminFormInstance<Output> {
  validate: () => Promise<Output | false>
  submit: () => Promise<void>
  clear: (name?: string | RegExp) => void
  setErrors: (errors: FormError[]) => void
  getErrors: (name?: string | RegExp) => FormError[]
}

function copyValue<T>(value: T): T {
  const raw = toRaw(value)
  if (Array.isArray(raw)) return raw.map(copyValue) as T
  if (raw instanceof Date) return new Date(raw) as T
  if (raw && typeof raw === 'object' && Object.getPrototypeOf(raw) === Object.prototype) {
    return Object.fromEntries(Object.entries(raw).map(([key, item]) => [key, copyValue(item)])) as T
  }
  return raw
}

export interface AdminFormOptions<State extends object, Item, Schema extends AdminFormSchema> {
  state: State
  initialValues: () => State
  /** Keep the visible fields and their validation schema in one reactive value. */
  config: MaybeRefOrGetter<AdminFormConfig<State, Item, Schema>>
  item?: MaybeRefOrGetter<Item | null>
  /** Useful when another composable owns hydration or needs to suppress field watchers. */
  replaceValues?: (values: State) => void
}

/** Imperative form API; editing state and overlays are composed separately. */
export function useAdminForm<State extends object, Item, Schema extends AdminFormSchema>(options: AdminFormOptions<State, Item, Schema>) {
  const formRef = shallowRef<AdminFormInstance<z.output<Schema>> | null>(null)
  const configOverride = shallowRef<AdminFormConfig<State, Item, Schema> | null>(null)
  const config = computed(() => configOverride.value ?? toValue(options.config))

  function getValues(): State {
    return copyValue(options.state)
  }

  function setValues(values: Partial<State>) {
    Object.assign(options.state, copyValue(values))
  }

  function resetForm() {
    const values = copyValue(options.initialValues())
    if (options.replaceValues) options.replaceValues(values)
    else {
      for (const key of Object.keys(options.state)) {
        if (!Object.hasOwn(values, key)) Reflect.deleteProperty(options.state, key)
      }
      Object.assign(options.state, values)
    }
    formRef.value?.clear()
  }

  function setConfig(nextConfig: AdminFormConfig<State, Item, Schema>) {
    configOverride.value = nextConfig
    formRef.value?.clear()
  }

  function resetConfig() {
    configOverride.value = null
    formRef.value?.clear()
  }

  async function mountedForm() {
    await nextTick()
    if (!formRef.value) throw new Error('AdminForm 尚未挂载')
    return formRef.value
  }

  async function validate(): Promise<z.output<Schema> | false> {
    return (await mountedForm()).validate()
  }

  async function submitForm() {
    await (await mountedForm()).submit()
  }

  const formProps = computed(() => ({
    state: options.state,
    item: toValue(options.item) ?? null,
    config: config.value,
  }))

  return {
    form: options.state,
    formRef,
    config,
    formProps,
    getValues,
    setValues,
    resetForm,
    setConfig,
    resetConfig,
    validate,
    submitForm,
    clearValidate: (name?: string | RegExp) => formRef.value?.clear(name),
    setErrors: (errors: FormError[]) => formRef.value?.setErrors(errors),
    getErrors: (name?: string | RegExp) => formRef.value?.getErrors(name) ?? [],
  }
}
