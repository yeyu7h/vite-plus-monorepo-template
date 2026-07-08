<script setup lang="ts">
import type { AdminTabItem } from '@monorepo-admin-core/types'
import { TabsView } from '@monorepo-admin-core/tabs-ui'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const router = useRouter()
const route = useRoute()
const tabs = ref<AdminTabItem[]>([])

const activePath = computed(() => resolveRouteTab().path)

watch(
  () => route.fullPath,
  () => {
    addRouteTab()
  },
  { immediate: true },
)

function addRouteTab() {
  if (route.meta.externalLink) return

  const tab = resolveRouteTab()
  if (!tab.title) return

  const path = tab.path
  const existingIndex = tabs.value.findIndex((tab) => tab.path === path)

  if (existingIndex === -1) {
    tabs.value = [...tabs.value, tab]
    return
  }

  tabs.value = tabs.value.map((item, index) => (index === existingIndex ? tab : item))
}

function resolveRouteTab(): AdminTabItem {
  const parentTabPath = route.meta.hideInTab ? route.meta.activePath : undefined
  const path = typeof parentTabPath === 'string' ? parentTabPath : route.fullPath
  const resolvedRoute = typeof parentTabPath === 'string' ? router.resolve(parentTabPath) : route
  const title = resolvedRoute.meta.title ?? route.meta.title

  return {
    active: path === activePath.value,
    icon: resolvedRoute.meta.icon ?? route.meta.icon,
    path,
    title: title ?? path,
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

  if (path === activePath.value && nextTab) {
    await router.push(nextTab.path)
  }
}

function refreshTab(path: string) {
  if (path !== activePath.value) return
  router.go(0)
}
</script>

<template>
  <TabsView :active-path="activePath" :tabs="tabs" @close="closeTab" @refresh="refreshTab" @select="selectTab" />
</template>
