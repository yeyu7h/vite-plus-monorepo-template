<script setup lang="ts">
definePage({
  meta: {
    initial: true,
    source: 'core',
    ignoreAccess: true,
    hideInMenu: true,
    title: '入口',
  },
  redirect: '/auth/login',
})
</script>

<template>
  <div class="flex h-screen items-center justify-center text-sm text-muted">正在进入系统...</div>
</template>
