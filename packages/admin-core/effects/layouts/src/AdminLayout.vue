<script setup lang="ts">
import { Layout } from '@monorepo-admin-core/layout-ui'
import Tabbar from './basic/tabbar/Tabbar.vue'
</script>

<template>
  <Layout :tabbar-enable="true">
    <slot />

    <template #tabbar>
      <Tabbar />
    </template>
  </Layout>
</template>
