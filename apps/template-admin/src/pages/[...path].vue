<script setup lang="ts">
import { Fallback } from '@monorepo-admin-core/common-ui'
import { useAdminAuthStore } from '@/stores/auth'

definePage({
  meta: {
    initial: true,
    layout: false,
    source: 'fallback',
    ignoreAccess: true,
    hideInMenu: true,
    title: '页面不存在',
  },
})

const authStore = useAdminAuthStore()
</script>

<template>
  <Fallback status="404" :home-path="authStore.homePath" />
</template>
