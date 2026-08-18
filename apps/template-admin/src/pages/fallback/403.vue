<script setup lang="ts">
import { Fallback } from '@monorepo-admin-core/common-ui'
import { useAdminAuthStore } from '@/stores/auth'

definePage({
  meta: {
    initial: true,
    source: 'fallback',
    ignoreAccess: true,
    hideInMenu: true,
    title: '403',
  },
})

const authStore = useAdminAuthStore()
</script>

<template>
  <Fallback class="h-full min-h-0!" status="403" :home-path="authStore.homePath" />
</template>
