<script setup lang="ts">
import type { AdminTabItem } from '@monorepo-admin-core/types'
import { TabsView } from '@monorepo-admin-core/tabs-ui'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const router = useRouter()
const route = useRoute()
const tabs = ref<AdminTabItem[]>([])

const activePath = computed(() => route.fullPath)

watch(
  () => route.fullPath,
  () => {
    addRouteTab()
  },
  { immediate: true },
)

function addRouteTab() {
  if (route.meta.hideInTab || !route.meta.title) return
  if (route.meta.externalLink) return

  const path = route.fullPath
  const existingIndex = tabs.value.findIndex((tab) => tab.path === path)
  const tab = createRouteTab()

  if (existingIndex === -1) {
    tabs.value = [...tabs.value, tab]
    return
  }

  tabs.value = tabs.value.map((item, index) => (index === existingIndex ? tab : item))
}

function createRouteTab(): AdminTabItem {
  return {
    active: route.fullPath === activePath.value,
    icon: route.meta.icon,
    path: route.fullPath,
    title: route.meta.title ?? activePath.value,
  }
}

async function selectTab(path: string) {
  await router.push(path)
}

async function closeTab(path: string) {
  if (tabs.value.length <= 1) return

  const index = tabs.value.findIndex((tab) => tab.path === path)
  if (index === -1) return

  const nextTab = tabs.value[index + 1] ?? tabs.value[index - 1]
  tabs.value = tabs.value.filter((tab) => tab.path !== path)

  if (path === route.fullPath && nextTab) {
    await router.push(nextTab.path)
  }
}

function refreshTab(path: string) {
  if (path !== route.fullPath) return
  router.go(0)
}
</script>

<template>
  <TabsView :active-path="activePath" :tabs="tabs" @close="closeTab" @refresh="refreshTab" @select="selectTab" />
</template>
