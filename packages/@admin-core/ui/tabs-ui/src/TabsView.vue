<script setup lang="ts">
import type { AdminTabItem } from '@monorepo-admin-core/types'
import Tabs from './components/Tabs.vue'

defineProps<{
  activeKey: string
  tabs: AdminTabItem[]
}>()

const emit = defineEmits<{
  close: [key: string]
  pin: [key: string, pinned: boolean]
  refresh: [key: string]
  select: [key: string]
}>()
</script>

<template>
  <div class="flex h-full min-w-0 justify-between">
    <Tabs :active-key="activeKey" :tabs="tabs" @close="emit('close', $event)" @pin="(key, pinned) => emit('pin', key, pinned)" @select="emit('select', $event)" />

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
