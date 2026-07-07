<script setup lang="ts">
import type { AdminTabItem } from '@monorepo-admin-core/types'
import Tabs from './components/Tabs.vue'

defineProps<{
  activePath: string
  tabs: AdminTabItem[]
}>()

const emit = defineEmits<{
  close: [path: string]
  refresh: [path: string]
  select: [path: string]
}>()
</script>

<template>
  <div class="flex h-full justify-between">
    <Tabs :active-path="activePath" :tabs="tabs" @close="emit('close', $event)" @select="emit('select', $event)" />

    <div class="flex h-full">
      <button
        class="flex h-full w-10 shrink-0 items-center justify-center border-l border-default select-none hover:bg-elevated hover:dark:bg-default"
        type="button"
        title="重新加载此标签页"
        @click="emit('refresh', activePath)"
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
