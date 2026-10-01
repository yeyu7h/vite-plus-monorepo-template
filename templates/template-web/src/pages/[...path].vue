<script setup lang="ts">
import SiteShell from '@/components/SiteShell.vue'
</script>

<template>
  <SiteShell>
    <UContainer class="py-24 text-center">
      <p class="text-sm font-semibold text-primary">404</p>
      <h1 class="mt-4 text-3xl font-bold text-highlighted">页面不存在</h1>
      <p class="mt-3 text-muted">地址可能已变更，返回首页继续浏览。</p>
      <UButton class="mt-8" to="/" label="返回首页" />
    </UContainer>
  </SiteShell>
</template>
