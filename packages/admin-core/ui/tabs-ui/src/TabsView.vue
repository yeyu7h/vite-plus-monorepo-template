<script setup lang="ts">
import Tabs from './components/Tabs.vue'
</script>

<template>
  <div class="flex h-full justify-between">
    <Tabs />

    <div class="flex h-full">
      <button class="flex h-full w-10 shrink-0 items-center justify-center border-l border-default select-none hover:bg-elevated hover:dark:bg-default" type="button" title="重新加载此标签页">
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
