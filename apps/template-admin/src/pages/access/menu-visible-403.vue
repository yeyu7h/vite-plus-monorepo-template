<script setup lang="ts">
definePage({
  meta: {
    title: '可见但无权限',
    icon: 'i-lucide-eye-off',
  },
})
</script>

<template>
  <section class="space-y-4">
    <div>
      <h1 class="text-xl font-semibold text-highlighted">可见但无权限</h1>
      <p class="mt-1 text-sm text-muted">该页面用于演示 Vben 的 menuVisibleWithForbidden 权限路由行为。</p>
    </div>

    <UCard>
      <div class="space-y-2 text-sm">
        <p>admin 角色可以访问当前页面。</p>
        <p>user 角色可以在菜单中看到入口，但访问时会渲染 403 页面。</p>
      </div>
    </UCard>
  </section>
</template>
