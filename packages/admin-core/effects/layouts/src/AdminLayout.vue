<script setup lang="ts">
import { Layout } from '@monorepo-admin-core/layout-ui'
import { LayoutTabbar } from './basic/tabbar'
import { LayoutMenu } from './basic/menu'
</script>

<template>
  <Layout :tabbar-enable="true">
    <slot />

    <template #menu="{ collapsed, opened }">
      <LayoutMenu :collapsed="collapsed" :opened="opened" />
    </template>

    <template #tabbar>
      <LayoutTabbar />
    </template>
  </Layout>
</template>
