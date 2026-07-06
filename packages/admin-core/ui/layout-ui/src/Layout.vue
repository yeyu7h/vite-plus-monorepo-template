<script setup lang="ts">
import { useLayout } from './hooks/use-layout'
import { ref } from 'vue'
import type { NavigationMenuItem, BreadcrumbItem } from '@nuxt/ui'
import type { LayoutProps } from './layout'
import LayoutTabbar from './components/LayoutTabbar.vue'
import LayoutSidebar from './components/LayoutSidebar.vue'
import LayoutHeader from './components/LayoutHeader.vue'

const props = withDefaults(defineProps<LayoutProps>(), {
  tabbarEnable: true,
  layout: 'sidebar-nav',
})

const { tabbar } = useLayout(props)
</script>

<template>
  <UDashboardGroup unit="px">
    <LayoutSidebar>
      <template #menu="{ collapsed, opened }">
        <slot name="menu" :collapsed="collapsed" :opened="opened" />
      </template>
    </LayoutSidebar>

    <UDashboardPanel :ui="{ body: 'relative' }">
      <template #header>
        <LayoutHeader />

        <LayoutTabbar v-if="tabbar">
          <slot name="tabbar" />
        </LayoutTabbar>
      </template>

      <template #body>
        <slot />
      </template>
    </UDashboardPanel>
  </UDashboardGroup>
</template>
