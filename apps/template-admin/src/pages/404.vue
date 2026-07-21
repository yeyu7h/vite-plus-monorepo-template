<script setup lang="ts">
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
</script>

<template>
  <main class="grid min-h-screen place-items-center bg-muted/30 px-4">
    <UCard class="w-full max-w-md text-center">
      <p class="text-6xl font-semibold text-muted">404</p>
      <h1 class="mt-4 text-xl font-semibold text-highlighted">页面不存在</h1>
      <p class="mt-2 text-sm text-muted">请检查地址是否正确，或返回首页继续操作。</p>
      <div class="mt-6">
        <UButton to="/dashboard/workbench">返回首页</UButton>
      </div>
    </UCard>
  </main>
</template>
