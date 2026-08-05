<script setup lang="ts">
import type { LayoutProps } from './layout'

import { cn, platform } from '@monorepo/shared/utils'
import { computed } from 'vue'

import LayoutTabbar from './components/LayoutTabbar.vue'
import LayoutSidebar from './components/LayoutSidebar.vue'
import LayoutHeader from './components/LayoutHeader.vue'

import { useLayout } from './hooks/use-layout'

const props = withDefaults(defineProps<LayoutProps>(), {
  contentMode: 'default',
  tabbarEnable: true,
})

const { tabbar } = useLayout(props)

const bodyClass = computed(() => cn('isolate relative min-w-0 p-0 sm:gap-0 sm:p-0', props.contentMode === 'full' ? 'min-h-0 overflow-hidden ' : platform.is.mobile ? 'overflow-y-visible' : void 0))
</script>

<template>
  <UDashboardGroup :ui="{ base: platform.is.mobile ? 'static inset-auto min-h-svh overflow-visible' : void 0 }" unit="px">
    <LayoutSidebar>
      <template #menu="{ collapsed, opened }">
        <slot name="menu" :collapsed="collapsed" :opened="opened" />
      </template>
    </LayoutSidebar>

    <UDashboardPanel :ui="{ body: bodyClass }">
      <template #header>
        <LayoutHeader :breadcrumb-prefix="breadcrumbPrefix" :breadcrumbs="breadcrumbs">
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
