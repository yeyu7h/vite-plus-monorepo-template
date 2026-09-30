<script setup lang="ts">
import { TabsView } from '@monorepo-admin-core/tabs-ui'
import { useAdminTabbar } from './use-admin-tabbar'

const props = defineProps<{
  storageKey?: string
}>()

const { activeKey, closeOtherTabs, closeRightTabs, closeTab, moveTab, openBrowserTab, openIframeSource, pinTab, refreshTab, selectTab, tabs } = useAdminTabbar({
  storageKey: props.storageKey,
})
</script>

<template>
  <TabsView
    :active-key="activeKey"
    :tabs="tabs"
    @close="closeTab"
    @close-others="closeOtherTabs"
    @close-right="closeRightTabs"
    @reorder="moveTab"
    @open-browser-tab="openBrowserTab"
    @open-iframe-source="openIframeSource"
    @pin="pinTab"
    @refresh="refreshTab"
    @select="selectTab"
  />
</template>
