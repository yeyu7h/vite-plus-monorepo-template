<script setup lang="ts">
definePage({
  meta: {
    title: '系统',
    icon: 'i-lucide-settings',
    group: {
      label: '系统管理',
      order: 20,
    },
    order: 20,
  },
})
</script>

<template>
  <RouterView />
</template>
