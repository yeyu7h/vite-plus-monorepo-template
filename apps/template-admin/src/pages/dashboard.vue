<script setup lang="ts">
import { useRouter } from 'vue-router'

definePage({
  meta: {
    title: '仪表盘',
    icon: 'i-lucide-gauge',
    menuGroup: {
      label: '概览',
      order: 10,
    },
    order: 10,
  },
})

const router = useRouter()
console.log('[router.getRoutes()]-18', router.getRoutes())
</script>

<template>
  <RouterView />
</template>
