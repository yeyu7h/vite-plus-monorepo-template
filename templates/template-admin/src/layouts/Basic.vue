<script setup lang="ts">
import { AdminLayout } from '@monorepo-admin-core/layout-effect'
import UserMenu from '@/components/UserMenu.vue'
import { ADMIN_TAB_STORAGE_KEY } from '@/constants/storage'
import { useAdminAccessStore } from '@/stores/access'

const accessStore = useAdminAccessStore()
</script>

<template>
  <AdminLayout :menu-groups="accessStore.menuGroups" :route-records="accessStore.navigationRoutes" :tab-storage-key="ADMIN_TAB_STORAGE_KEY">
    <template #footer="{ collapsed, opened, setOverlayOpen }">
      <UserMenu :collapsed="collapsed && !opened" @update:open="setOverlayOpen" />
    </template>
  </AdminLayout>
</template>
