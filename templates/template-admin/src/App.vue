<script setup lang="ts">
import { useToast } from '@nuxt/ui/runtime/composables/useToast.js'
import { onUnmounted } from 'vue'
import { setRequestErrorNotifier } from '@/api/request'

const toast = useToast()

setRequestErrorNotifier((message) => {
  toast.add({ id: `request-error:${message}`, title: message, color: 'error' })
})

onUnmounted(() => setRequestErrorNotifier())
</script>

<template>
  <UApp>
    <RouterView />
  </UApp>
</template>
