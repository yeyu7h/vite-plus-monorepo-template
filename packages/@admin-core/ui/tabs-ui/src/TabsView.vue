<script setup lang="ts">
import type { AdminTabItem, AdminTabPlacement } from '@monorepo-admin-core/types'
import Tabs from './components/Tabs.vue'

defineProps<{
  activeKey: string
  tabs: AdminTabItem[]
}>()

const emit = defineEmits<{
  close: [key: string]
  closeOthers: [key: string]
  closeRight: [key: string]
  openBrowserTab: [key: string]
  openIframeSource: [key: string]
  pin: [key: string, pinned: boolean]
  reorder: [key: string, targetKey: string, placement: AdminTabPlacement]
  refresh: [key: string]
  select: [key: string]
}>()
</script>

<template>
  <div class="flex h-full min-w-0 justify-between">
    <Tabs
      :active-key="activeKey"
      :tabs="tabs"
      @close="emit('close', $event)"
      @close-others="emit('closeOthers', $event)"
      @close-right="emit('closeRight', $event)"
      @open-browser-tab="emit('openBrowserTab', $event)"
      @open-iframe-source="emit('openIframeSource', $event)"
      @pin="(key, pinned) => emit('pin', key, pinned)"
      @reorder="(key, targetKey, placement) => emit('reorder', key, targetKey, placement)"
      @refresh="emit('refresh', $event)"
      @select="emit('select', $event)"
    />

    <div class="flex h-full">
      <button
        class="relative flex h-full w-10 shrink-0 items-center justify-center select-none before:pointer-events-none before:absolute before:inset-y-0 before:-left-px before:w-px before:bg-border before:content-[''] hover:bg-elevated hover:dark:bg-default"
        type="button"
        title="重新加载此标签页"
        @click="emit('refresh', activeKey)"
      >
        <UIcon name="i-lucide-refresh-cw" />
      </button>
    </div>
  </div>
</template>
