<script setup lang="ts">
definePage({
  meta: {
    initial: true,
    source: 'fallback',
    ignoreAccess: true,
    hideInMenu: true,
    title: '无权限',
  },
})
</script>

<template>
  <main class="absolute inset-0 grid place-items-center p-4">
    <UCard class="w-full max-w-md text-center">
      <p class="text-6xl font-semibold text-warning">403</p>
      <h1 class="mt-4 text-xl font-semibold text-highlighted">无访问权限</h1>
      <p class="mt-2 text-sm text-muted">当前账号没有访问该页面的权限。</p>
    </UCard>
  </main>
</template>
