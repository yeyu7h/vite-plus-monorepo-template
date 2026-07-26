<script setup lang="ts">
import { TabsView } from '@monorepo-admin-core/tabs-ui'
import { useAdminTabbar } from './use-admin-tabbar'

const { activeKey, closeTab, refreshTab, selectTab, tabs } = useAdminTabbar()
</script>

<template>
  <TabsView :active-key="activeKey" :tabs="tabs" @close="closeTab" @refresh="refreshTab" @select="selectTab" />
</template>
