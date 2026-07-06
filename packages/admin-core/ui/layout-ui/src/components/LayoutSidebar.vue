<script setup lang="ts">
import { ref } from 'vue'

const collapsed = ref(false)
const opened = ref(false)
</script>

<template>
  <UDashboardSidebar v-model:collapsed="collapsed" v-model:open="opened" resizable collapsible :default-size="250" :max-size="350" :min-size="200" :ui="{ root: 'bg-muted/50 dark:bg-muted/20' }">
    <template #header="{ collapsed }">
      <div class="flex justify-between items-center w-full">
        <div>Logo</div>
      </div>
    </template>

    <slot name="menu" :collapsed="collapsed" :opened="opened" />
  </UDashboardSidebar>
</template>
