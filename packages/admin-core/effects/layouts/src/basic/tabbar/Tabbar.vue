<script setup lang="ts">
import { TabsView } from '@monorepo-admin-core/tabs-ui'
import { useAdminTabbar } from './use-admin-tabbar'

const props = withDefaults(
  defineProps<{
    storageKey?: string
    widthTransition?: boolean
  }>(),
  {
    widthTransition: true,
  },
)

const { activeKey, closeTab, refreshTab, selectTab, tabs } = useAdminTabbar({
  storageKey: props.storageKey,
})
</script>

<template>
  <TabsView :active-key="activeKey" :tabs="tabs" :width-transition="widthTransition" @close="closeTab" @refresh="refreshTab" @select="selectTab" />
</template>
