<script setup lang="ts">
definePage({
  meta: {
    title: '任务监控',
    icon: {
      light: 'https://raw.githubusercontent.com/Koolson/Qure/refs/heads/master/IconSet/Color/App_Store.png',
      dark: 'https://raw.githubusercontent.com/Koolson/Qure/refs/heads/master/IconSet/Color/App_Store.png',
    },
    order: 50,
  },
})

const jobs = [
  { name: '同步用户数据', status: 'running' },
  { name: '生成日报', status: 'idle' },
  { name: '清理缓存', status: 'scheduled' },
]
</script>

<template>
  <div class="p-6 space-y-4">
    <div>
      <h1 class="text-xl font-semibold text-highlighted">任务监控</h1>
      <p class="mt-1 text-sm text-muted">Job monitor without menu group</p>
    </div>

    <div class="divide-y divide-default rounded-md border border-default bg-default">
      <div v-for="job in jobs" :key="job.name" class="flex items-center justify-between px-4 py-3">
        <span class="text-sm font-medium text-default">{{ job.name }}</span>
        <span class="text-xs text-muted">{{ job.status }}</span>
      </div>
    </div>
  </div>
</template>
