<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAdminAccessStore } from '@/stores/access'

definePage({
  meta: {
    title: '系统设置',
    icon: 'i-lucide-settings',
    menuGroup: {
      label: '系统管理',
      order: 20,
    },
    order: 30,
  },
})

const route = useRoute()
const accessStore = useAdminAccessStore()

const settingsMenus = computed(() =>
  accessStore.navigationRoutes
    .flatMap((routeRecord) => {
      const { description, order = 0, title } = routeRecord.meta

      if (routeRecord.parentPath !== '/system/settings' || !title) return []

      return [{ description, order, path: routeRecord.path, title }]
    })
    .sort((left, right) => left.order - right.order),
)

const activeMenu = computed(() => settingsMenus.value.find((item) => route.path === item.path))
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
