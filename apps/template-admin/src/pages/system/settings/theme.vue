<script setup lang="ts">
definePage({
  meta: {
    title: '主题设置',
    description: '主题色、圆角和显示密度',
    hideInMenu: true,
    activePath: '/system/settings',
    order: 20,
    tabPath: '/system/settings',
  },
})

const themeSettings = [
  { label: '主题色', value: 'Emerald' },
  { label: '圆角', value: 'Medium' },
  { label: '显示密度', value: 'Compact' },
]
</script>

<template>
  <div class="p-6 space-y-4">
    <div>
      <h2 class="text-lg font-semibold text-highlighted">主题设置</h2>
      <p class="mt-1 text-sm text-muted">This page keeps the global menu active on system settings.</p>
    </div>

    <dl class="divide-y divide-default">
      <div v-for="setting in themeSettings" :key="setting.label" class="grid grid-cols-[8rem_1fr] gap-4 py-4 text-sm">
        <dt class="text-muted">{{ setting.label }}</dt>
        <dd class="font-medium text-default">{{ setting.value }}</dd>
      </div>
    </dl>
  </div>
</template>
