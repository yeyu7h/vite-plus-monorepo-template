<script setup lang="ts">
import { AdminLayout } from '@monorepo-admin-core/layout-effect'
import { computed } from 'vue'
import { useAdminAccessStore } from '@/stores/access'

const accessStore = useAdminAccessStore()
const userLabel = computed(() => accessStore.userInfo?.real_name ?? accessStore.userInfo?.username ?? 'User')
</script>

<template>
  <AdminLayout :menu-groups="accessStore.menuGroups" :route-records="accessStore.navigationRoutes">
    <RouterView />

    <template #header-right>
      <UDropdownMenu
        :items="[
          [
            {
              label: userLabel,
              type: 'label',
            },
            {
              label: `角色：${accessStore.userInfo?.roles.join(', ') || '-'}`,
              type: 'label',
            },
          ],
          [
            {
              label: '退出登录',
              icon: 'i-lucide-log-out',
              onSelect: () => accessStore.logout(),
            },
          ],
        ]"
      >
        <UButton color="neutral" variant="ghost" trailing-icon="i-lucide-chevron-down">
          {{ userLabel }}
        </UButton>
      </UDropdownMenu>
    </template>
  </AdminLayout>
</template>
