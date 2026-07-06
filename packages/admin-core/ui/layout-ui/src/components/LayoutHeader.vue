<script setup lang="ts">
import type { BreadcrumbItem } from '@nuxt/ui'
import { ref } from 'vue'

const items = ref<BreadcrumbItem[]>([
  {
    label: 'Docs',
    icon: 'i-lucide-book-open',
    to: '/docs',
  },
  {
    label: 'Components',
    icon: 'i-lucide-box',
    to: '/docs/components',
  },
  {
    label: 'Breadcrumb',
    icon: 'i-lucide-link',
    to: '/docs/components/breadcrumb',
  },
])
</script>

<template>
  <UDashboardNavbar :ui="{ root: 'bg-muted/50 dark:bg-muted/20' }">
    <template #left>
      <UBreadcrumb :items="items" />
    </template>

    <template #right>123123</template>
  </UDashboardNavbar>
</template>
