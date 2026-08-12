<script setup lang="ts">
import type { AdminTabItem } from '@monorepo-admin-core/types'
import Tabs from './components/Tabs.vue'

withDefaults(
  defineProps<{
    activeKey: string
    tabs: AdminTabItem[]
    widthTransition?: boolean
  }>(),
  {
    widthTransition: true,
  },
)

const emit = defineEmits<{
  close: [key: string]
  refresh: [key: string]
  select: [key: string]
}>()
</script>

<template>
  <div class="flex h-full min-w-0 justify-between">
    <Tabs :active-key="activeKey" :tabs="tabs" :width-transition="widthTransition" @close="emit('close', $event)" @select="emit('select', $event)" />

    <div class="flex h-full">
      <button
        class="relative flex h-full w-10 shrink-0 items-center justify-center select-none before:pointer-events-none before:absolute before:inset-y-0 before:-left-px before:w-px before:bg-border before:content-[''] hover:bg-elevated hover:dark:bg-default"
        type="button"
        title="重新加载此标签页"
        @click="emit('refresh', activeKey)"
      >
        <UIcon name="i-lucide-refresh-cw" />
      </button>

      <!-- <button
        class="flex h-full w-10 shrink-0 items-center justify-center border-l border-default select-none hover:bg-elevated hover:dark:bg-default"
        type="button"
      >
        <UIcon name="i-lucide-chevron-down" size="20" />
      </button> -->
    </div>
  </div>
</template>
