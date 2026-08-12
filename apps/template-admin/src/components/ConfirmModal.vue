<script setup lang="ts">
import { ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    open?: boolean
    title: string
    description?: string
    confirmLabel?: string
    cancelLabel?: string
    confirmDisabled?: boolean
    errorTitle?: string
    onConfirm: () => Promise<void> | void
    formatError?: (error: unknown) => string
  }>(),
  {
    open: false,
    description: '',
    confirmLabel: '确认',
    cancelLabel: '取消',
    confirmDisabled: false,
    errorTitle: '操作失败',
    formatError: (error: unknown) => (error instanceof Error ? error.message : '操作失败，请稍后重试'),
  },
)

const emit = defineEmits<{
  close: [confirmed: boolean]
  'update:open': [open: boolean]
}>()

const pending = ref(false)
const errorMessage = ref('')

watch(
  () => props.open,
  (open) => {
    if (open) errorMessage.value = ''
  },
)

function close(confirmed: boolean) {
  if (pending.value) return
  emit('close', confirmed)
}

function updateOpen(open: boolean) {
  if (!open && pending.value) return
  emit('update:open', open)
  if (!open) emit('close', false)
}

async function submit() {
  if (pending.value || props.confirmDisabled) return

  pending.value = true
  errorMessage.value = ''

  try {
    await props.onConfirm()
    emit('close', true)
  } catch (error) {
    errorMessage.value = props.formatError(error)
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <UModal :open="open" :title="title" :description="description" :close="!pending" :dismissible="!pending" :ui="{ footer: 'justify-end' }" @update:open="updateOpen">
    <template v-if="errorMessage" #body>
      <UAlert :title="errorTitle" :description="errorMessage" color="error" variant="soft" />
    </template>

    <template #footer>
      <UButton :label="cancelLabel" color="neutral" variant="outline" :disabled="pending" @click="close(false)" />
      <UButton :label="confirmLabel" color="error" :disabled="confirmDisabled" :loading="pending" @click="submit" />
    </template>
  </UModal>
</template>
