<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const settingsMenus = [
  {
    description: '邮件、站内信和安全提醒',
    path: '/system/settings/notification',
    title: '通知设置',
  },
  {
    description: '主题色、圆角和显示密度',
    path: '/system/settings/theme',
    title: '主题设置',
  },
]

const activeMenu = computed(() => settingsMenus.find((item) => route.path === item.path))
</script>

<template>
  <div class="p-6 space-y-4">
    <div>
      <h1 class="text-xl font-semibold text-highlighted">系统设置</h1>
      <p class="mt-1 text-sm text-muted">Settings routes rendered inside the content area</p>
    </div>

    <div class="grid gap-4 lg:grid-cols-[16rem_1fr]">
      <nav class="space-y-2 rounded-md border border-default bg-default p-2">
        <RouterLink
          v-for="item in settingsMenus"
          :key="item.path"
          :to="item.path"
          class="block rounded-md px-3 py-2 transition-colors"
          :class="route.path === item.path ? 'bg-elevated text-highlighted' : 'text-muted hover:bg-elevated/60 hover:text-default'"
        >
          <span class="block text-sm font-medium">{{ item.title }}</span>
          <span class="mt-1 block text-xs">{{ item.description }}</span>
        </RouterLink>
      </nav>

      <section class="min-w-0 rounded-md border border-default bg-default">
        <RouterView v-slot="{ Component }">
          <component :is="Component" v-if="Component" />
          <div v-else class="p-6">
            <h2 class="text-base font-semibold text-highlighted">请选择设置项</h2>
            <p class="mt-1 text-sm text-muted">当前内容区会渲染通知设置、主题设置等子路由。</p>
            <p v-if="activeMenu" class="mt-4 text-sm text-muted">当前设置项：{{ activeMenu.title }}</p>
          </div>
        </RouterView>
      </section>
    </div>
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
