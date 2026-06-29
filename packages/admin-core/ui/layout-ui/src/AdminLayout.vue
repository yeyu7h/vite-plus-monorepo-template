<script setup lang="ts">
import { useLayout } from './hooks/use-layout'
import { ref } from 'vue'
import type { NavigationMenuItem } from '@nuxt/ui'
import type { AdminLayoutProps } from './admin-layout'

const props = withDefaults(defineProps<AdminLayoutProps>(), {
  tabbarEnable: true,
  layout: 'sidebar-nav',
})

const { tabbar } = useLayout(props)

const collapsed22 = ref(false)
const open = ref(false)

const items: NavigationMenuItem[] = [
  {
    label: 'Home',
    icon: 'i-lucide-house',
    active: true,
  },
  {
    label: 'Inbox',
    icon: 'i-lucide-inbox',
  },
  {
    label: 'Contacts12312',
    icon: 'i-lucide-users',
  },
]
</script>

<template>
  <UDashboardGroup unit="px">
    <UDashboardSidebar v-model:collapsed="collapsed22" v-model:open="open" resizable collapsible :default-size="250" :max-size="350" :min-size="200">
      <template #header="{ collapsed }">
        <div class="flex justify-between items-center w-full">
          <div>Logo</div>
          <UButton v-if="!collapsed" icon="i-lucide-panel-left" variant="ghost" color="neutral" :ui="{ base: '-mr-1' }" @click="collapsed22 = !collapsed22" />
        </div>
      </template>
      <!-- <template #header>
        <div>123123</div>
      </template> -->
      <!-- <template #toggle>
        <div>123</div>
      </template> -->

      <UNavigationMenu :collapsed="collapsed22 && !open" :items="items" orientation="vertical" />
    </UDashboardSidebar>

    <UDashboardPanel :ui="{ body: 'bg-muted' }">
      <template #header>
        <UDashboardNavbar>
          <!-- <template #title>
            <div>DashboardNavbar</div>
          </template> -->
        </UDashboardNavbar>

        <UDashboardToolbar v-if="tabbar">
          <div>DashboardToolbar</div>
        </UDashboardToolbar>
      </template>

      <template #body>
        <slot />
      </template>
    </UDashboardPanel>
  </UDashboardGroup>
</template>
