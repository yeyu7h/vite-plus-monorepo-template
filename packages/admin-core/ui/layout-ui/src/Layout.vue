<script setup lang="ts">
import { useLayout } from './hooks/use-layout'
import { resolveLayoutContentBodyClass, resolveLayoutGroupClass, resolveLayoutHeaderClass } from './layout'
import type { LayoutProps } from './layout'
import LayoutTabbar from './components/LayoutTabbar.vue'
import LayoutSidebar from './components/LayoutSidebar.vue'
import LayoutHeader from './components/LayoutHeader.vue'

const props = withDefaults(defineProps<LayoutProps>(), {
  contentMode: 'default',
  scrollMode: 'panel',
  stickyHeader: false,
  tabbarEnable: true,
  layout: 'sidebar-nav',
})

const { tabbar } = useLayout(props)
</script>

<template>
  <UDashboardGroup :ui="{ base: resolveLayoutGroupClass(props.contentMode, props.scrollMode) }" unit="px">
    <LayoutSidebar :content-mode="props.contentMode" :scroll-mode="props.scrollMode">
      <template #menu="{ collapsed, opened }">
        <slot name="menu" :collapsed="collapsed" :opened="opened" />
      </template>
    </LayoutSidebar>

    <UDashboardPanel :ui="{ body: resolveLayoutContentBodyClass(props.contentMode, props.scrollMode) }">
      <template #header>
        <div :class="resolveLayoutHeaderClass(props.contentMode, props.scrollMode, props.stickyHeader)">
          <LayoutHeader :breadcrumb-prefix="props.breadcrumbPrefix" :breadcrumbs="props.breadcrumbs">
            <template #right>
              <slot name="header-right" />
            </template>
          </LayoutHeader>

          <LayoutTabbar v-if="tabbar">
            <slot name="tabbar" />
          </LayoutTabbar>
        </div>
      </template>

      <template #body>
        <slot />
      </template>
    </UDashboardPanel>
  </UDashboardGroup>
</template>
