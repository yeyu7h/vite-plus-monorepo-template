<script setup lang="ts">
definePage({
  meta: {
    title: '工作台',
    icon: 'i-lucide-layout-dashboard',
    menuGroup: {
      label: '概览',
      order: 10,
    },
    order: 10,
  },
})

const metrics = [
  { label: '访问量', value: '128,430' },
  { label: '转化率', value: '18.6%' },
  { label: '待处理', value: '24' },
]
</script>

<template>
  <div class="p-6 space-y-6">
    <div>
      <h1 class="text-xl font-semibold text-highlighted">工作台</h1>
      <p class="mt-1 text-sm text-muted">Dashboard overview</p>
    </div>

    <div class="grid gap-4 md:grid-cols-3">
      <div v-for="metric in metrics" :key="metric.label" class="rounded-md border border-default bg-default p-4">
        <div class="text-sm text-muted">{{ metric.label }}</div>
        <div class="mt-2 text-2xl font-semibold text-highlighted">{{ metric.value }}</div>
      </div>
    </div>
  </div>
</template>
