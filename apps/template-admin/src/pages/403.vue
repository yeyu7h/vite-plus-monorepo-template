<script setup lang="ts">
import { useAdminAccessStore } from '@/stores/access'

definePage({
  meta: {
    initial: true,
    source: 'fallback',
    ignoreAccess: true,
    hideInMenu: true,
    title: '无权限',
  },
})

const accessStore = useAdminAccessStore()
</script>

<template>
  <main class="grid min-h-screen place-items-center bg-muted/30 px-4">
    <UCard class="w-full max-w-md text-center">
      <p class="text-6xl font-semibold text-warning">403</p>
      <h1 class="mt-4 text-xl font-semibold text-highlighted">无访问权限</h1>
      <p class="mt-2 text-sm text-muted">当前账号没有访问该页面的权限。</p>
      <div class="mt-6 flex justify-center gap-3">
        <UButton to="/dashboard/workbench">返回首页</UButton>
        <UButton color="neutral" variant="ghost" @click="accessStore.logout()">退出登录</UButton>
      </div>
    </UCard>
  </main>
</template>
