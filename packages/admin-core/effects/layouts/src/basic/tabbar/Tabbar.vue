<script setup lang="ts">
import { TabsView } from '@monorepo-admin-core/tabs-ui'
import { useAdminTabbar } from './use-admin-tabbar'

const { activePath, closeTab, refreshTab, selectTab, tabs } = useAdminTabbar()
</script>

<template>
  <TabsView :active-path="activePath" :tabs="tabs" @close="closeTab" @refresh="refreshTab" @select="selectTab" />
</template>
