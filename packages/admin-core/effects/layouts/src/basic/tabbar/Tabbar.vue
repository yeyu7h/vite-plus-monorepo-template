<script setup lang="ts">
import { TabsView } from '@monorepo-admin-core/tabs-ui'
import { useAdminTabbar } from './use-admin-tabbar'

const props = defineProps<{
  storageKey?: string
}>()

const { activeKey, closeTab, refreshTab, selectTab, tabs } = useAdminTabbar({
  storageKey: props.storageKey,
})
</script>

<template>
  <TabsView :active-key="activeKey" :tabs="tabs" @close="closeTab" @refresh="refreshTab" @select="selectTab" />
</template>
