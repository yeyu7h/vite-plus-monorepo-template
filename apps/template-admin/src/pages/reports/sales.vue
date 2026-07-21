<script setup lang="ts">
definePage({
  meta: {
    title: '销售报表',
    icon: 'i-lucide-chart-line',
    order: 40,
  },
})

const summary = [
  { label: '本月收入', value: '¥128,400' },
  { label: '订单数', value: '2,430' },
  { label: '客单价', value: '¥52.84' },
]
</script>

<template>
  <div class="p-6 space-y-4">
    <div>
      <h1 class="text-xl font-semibold text-highlighted">销售报表</h1>
      <p class="mt-1 text-sm text-muted">Sales report without menu group</p>
    </div>

    <div class="grid gap-4 md:grid-cols-3">
      <div v-for="item in summary" :key="item.label" class="rounded-md border border-default bg-default p-4">
        <div class="text-sm text-muted">{{ item.label }}</div>
        <div class="mt-2 text-2xl font-semibold text-highlighted">{{ item.value }}</div>
      </div>
    </div>
  </div>
</template>
