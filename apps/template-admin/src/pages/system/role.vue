<script setup lang="ts">
definePage({
  meta: {
    title: '角色管理',
    icon: 'i-lucide-shield-check',
    menuGroup: {
      label: '系统管理',
      order: 20,
    },
    order: 20,
    authority: ['admin'],
  },
})

const roles = ['管理员', '运营', '审计员']
</script>

<template>
  <div class="p-6 space-y-4">
    <div>
      <h1 class="text-xl font-semibold text-highlighted">角色管理</h1>
      <p class="mt-1 text-sm text-muted">Role permissions</p>
    </div>

    <div class="divide-y divide-default rounded-md border border-default bg-default">
      <div v-for="role in roles" :key="role" class="flex items-center justify-between px-4 py-3">
        <span class="text-sm font-medium text-default">{{ role }}</span>
        <span class="text-xs text-muted">enabled</span>
      </div>
    </div>
  </div>
</template>
