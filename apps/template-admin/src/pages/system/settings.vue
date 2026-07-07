<script setup lang="ts">
const settings = [
  { label: '登录保护', value: '开启' },
  { label: '审计日志', value: '保留 180 天' },
  { label: '会话超时', value: '30 分钟' },
]
</script>

<template>
  <div class="p-6 space-y-4">
    <div>
      <h1 class="text-xl font-semibold text-highlighted">系统设置</h1>
      <p class="mt-1 text-sm text-muted">System preferences</p>
    </div>

    <dl class="divide-y divide-default rounded-md border border-default bg-default">
      <div v-for="setting in settings" :key="setting.label" class="grid grid-cols-[10rem_1fr] px-4 py-3 text-sm">
        <dt class="text-muted">{{ setting.label }}</dt>
        <dd class="text-default">{{ setting.value }}</dd>
      </div>
    </dl>
  </div>
</template>

<route lang="json">
{
  "meta": {
    "title": "系统设置",
    "icon": "i-lucide-settings",
    "menuGroup": {
      "label": "系统管理",
      "order": 20
    },
    "order": 30
  }
}
</route>
