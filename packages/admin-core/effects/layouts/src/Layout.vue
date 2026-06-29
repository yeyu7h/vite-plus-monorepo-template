<script setup lang="ts">
import { AdminLayout } from '@monorepo-admin-core/layout-ui'
</script>

<template>
  <AdminLayout :tabbar-enable="true">
    <slot />
  </AdminLayout>
</template>

<style lang="scss"></style>
