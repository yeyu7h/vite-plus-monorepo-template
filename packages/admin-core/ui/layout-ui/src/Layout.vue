<script setup lang="ts">
import { useLayout } from './hooks/use-layout'
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
        <LayoutHeader :breadcrumb-prefix="props.breadcrumbPrefix" :breadcrumbs="props.breadcrumbs">
          <template #right>
            <slot name="header-right" />
          </template>
        </LayoutHeader>

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
