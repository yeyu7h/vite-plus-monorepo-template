<script setup lang="ts">
import type { ButtonProps, SlideoverProps } from '@nuxt/ui'
import { useId } from 'vue'

withDefaults(
  defineProps<{
    title: string
    description?: string
    saving?: boolean
    submitLabel?: string
    cancelVariant?: ButtonProps['variant']
    ui?: SlideoverProps['ui']
  }>(),
  { submitLabel: '保存', cancelVariant: 'outline' },
)

const open = defineModel<boolean>('open', { default: false })
const formId = `editor-${useId()}`
</script>

<template>
  <USlideover v-model:open="open" :title="title" :description="description" :ui="ui" :dismissible="!saving" :close="!saving">
    <template #body="{ close }"><slot name="body" :formId="formId" :close="close" /></template>
    <template #footer="{ close }">
      <slot name="footer" :formId="formId" :close="close">
        <UButton label="取消" color="neutral" :variant="cancelVariant" :disabled="saving" @click="close" />
        <UButton type="submit" :form="formId" :label="submitLabel" :loading="saving" />
      </slot>
    </template>
  </USlideover>
</template>
