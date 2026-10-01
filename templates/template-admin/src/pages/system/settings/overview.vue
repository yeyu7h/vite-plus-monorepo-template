<script setup lang="ts">
const levels = [
  { level: '一级', title: '系统', description: '左侧导航的顶层目录' },
  { level: '二级', title: '设置中心', description: '可展开的设置目录' },
  { level: '三级', title: '设置概览', description: '当前正在访问的页面' },
]
</script>

<template>
  <div class="p-6 space-y-6">
    <div>
      <div class="flex items-center gap-2">
        <h2 class="text-lg font-semibold text-highlighted">设置概览</h2>
        <UBadge color="success" variant="subtle" label="Level 3" />
      </div>
      <p class="mt-1 text-sm text-muted">当前菜单路径：系统 → 设置中心 → 设置概览</p>
    </div>

    <UAlert color="success" variant="subtle" icon="i-lucide-circle-check" title="设置导航已正常渲染" description="主题设置和通知设置会与本页共享同一个侧边栏菜单和 Tab。" />

    <div class="grid gap-3 md:grid-cols-3">
      <div v-for="item in levels" :key="item.level" class="rounded-lg border border-default bg-default p-4">
        <span class="text-xs font-medium text-primary">{{ item.level }}</span>
        <h3 class="mt-2 text-sm font-semibold text-highlighted">{{ item.title }}</h3>
        <p class="mt-1 text-sm text-muted">{{ item.description }}</p>
      </div>
    </div>
  </div>
</template>
