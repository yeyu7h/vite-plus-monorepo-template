<script setup lang="ts" generic="State extends object, Item, Schema extends AdminFormSchema">
import type { Form, FormError, FormErrorEvent, FormSubmitEvent } from '@nuxt/ui'
import { resolveComponent, useTemplateRef } from 'vue'
import type { z } from 'zod'

import type { AdminFormConfig, AdminFormField, AdminFormSchema } from './admin-form'

const props = defineProps<{
  id?: string
  state: State
  item?: Item | null
  config: AdminFormConfig<State, Item, Schema>
  disabled?: boolean
  class?: string
}>()

const emit = defineEmits<{
  submit: [event: FormSubmitEvent<z.output<Schema>>]
  error: [event: FormErrorEvent]
}>()

const form = useTemplateRef<Form<Schema>>('form')
const componentMap = {
  input: resolveComponent('UInput'),
  textarea: resolveComponent('UTextarea'),
  select: resolveComponent('USelect'),
  selectMenu: resolveComponent('USelectMenu'),
  inputNumber: resolveComponent('UInputNumber'),
  checkbox: resolveComponent('UCheckbox'),
  switch: resolveComponent('USwitch'),
}

function setValue(name: Extract<keyof State, string>, value: unknown) {
  Reflect.set(props.state, name, value)
}

function isDisabled(field: AdminFormField<State, Item>) {
  return typeof field.disabled === 'function' ? field.disabled(props.state, props.item ?? null) : field.disabled
}

async function validate() {
  if (!form.value) throw new Error('AdminForm 尚未挂载')
  return form.value.validate({ silent: true, transform: true })
}

async function submit() {
  if (!form.value) throw new Error('AdminForm 尚未挂载')
  await form.value.submit()
}

function clear(name?: string | RegExp) {
  form.value?.clear(name)
}

function setErrors(errors: FormError[]) {
  form.value?.setErrors(errors)
}

function getErrors(name?: string | RegExp) {
  return form.value?.getErrors(name) ?? []
}

defineExpose({ validate, submit, clear, setErrors, getErrors })
</script>

<template>
  <UForm ref="form" :id="id" :state="state" :schema="config.schema" :disabled="disabled" :class="props.class" @submit="emit('submit', $event)" @error="emit('error', $event)">
    <slot name="leading" :state="state" />
    <UFormField
      v-for="field in config.fields"
      :key="field.name"
      :name="field.name"
      :label="field.label"
      :description="field.description"
      :hint="field.hint"
      :required="field.required"
      :class="field.class"
    >
      <slot :name="field.slot ?? field.name" :field="field" :state="state" :value="state[field.name]" :set-value="(value: unknown) => setValue(field.name, value)">
        <component
          :is="componentMap[field.component ?? 'input']"
          v-if="field.component !== 'slot'"
          v-bind="field.componentProps"
          :model-value="state[field.name]"
          :disabled="isDisabled(field)"
          class="w-full"
          @update:model-value="setValue(field.name, $event)"
        />
      </slot>
    </UFormField>
    <slot name="actions" :state="state" />
  </UForm>
</template>
