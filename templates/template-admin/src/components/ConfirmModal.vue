<script setup lang="ts">
import { useMutation } from '@tanstack/vue-query'

const props = withDefaults(
  defineProps<{
    open?: boolean
    title: string
    description?: string
    confirmLabel?: string
    cancelLabel?: string
    confirmDisabled?: boolean
    onConfirm: () => Promise<void> | void
  }>(),
  {
    open: false,
    description: '',
    confirmLabel: '确认',
    cancelLabel: '取消',
    confirmDisabled: false,
  },
)

const emit = defineEmits<{
  close: [confirmed: boolean]
  'update:open': [open: boolean]
}>()

const { isPending: pending, mutate: confirm } = useMutation({
  mutationFn: async () => {
    await props.onConfirm()
  },
  onSuccess: () => {
    emit('close', true)
  },
})
function close(confirmed: boolean) {
  if (pending.value) return
  emit('close', confirmed)
}

function updateOpen(open: boolean) {
  if (!open && pending.value) return
  emit('update:open', open)
  if (!open) emit('close', false)
}

function submit() {
  if (pending.value || props.confirmDisabled) return
  confirm()
}
</script>

<template>
  <UModal :open="open" :title="title" :description="description" :close="!pending" :dismissible="!pending" :ui="{ footer: 'justify-end' }" @update:open="updateOpen">
    <template #footer>
      <UButton :label="cancelLabel" color="neutral" variant="outline" :disabled="pending" @click="close(false)" />
      <UButton :label="confirmLabel" color="error" :disabled="confirmDisabled" :loading="pending" @click="submit" />
    </template>
  </UModal>
</template>
