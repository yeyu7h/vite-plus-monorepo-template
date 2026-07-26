<script setup lang="ts">
definePage({
  meta: {
    title: '通知设置',
    hideInMenu: true,
    activePath: '/system/settings',
    order: 10,
    tabPath: '/system/settings',
  },
})

const channels = [
  { label: '邮件通知', status: '已开启', description: '用于发送账号安全、审批结果和系统公告。' },
  { label: '站内消息', status: '已开启', description: '登录后在消息中心展示待办提醒。' },
  { label: '短信提醒', status: '仅安全事件', description: '只对异地登录和密码变更发送短信。' },
]
</script>

<template>
  <div class="p-6 space-y-4">
    <div>
      <h2 class="text-lg font-semibold text-highlighted">通知设置</h2>
      <p class="mt-1 text-sm text-muted">This page is a nested content route under system settings.</p>
    </div>

    <div class="divide-y divide-default">
      <div v-for="channel in channels" :key="channel.label" class="flex items-start justify-between gap-4 py-4">
        <div>
          <h3 class="text-sm font-medium text-default">{{ channel.label }}</h3>
          <p class="mt-1 text-sm text-muted">{{ channel.description }}</p>
        </div>
        <span class="shrink-0 rounded-full bg-elevated px-2.5 py-1 text-xs text-muted">{{ channel.status }}</span>
      </div>
    </div>
  </div>
</template>
