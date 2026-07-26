<script setup lang="ts">
import { AdminLayout } from '@monorepo-admin-core/layout-effect'
import { computed } from 'vue'
import { useAdminAccessStore } from '@/stores/access'
import { useAdminUserStore } from '@/stores/user'

const accessStore = useAdminAccessStore()
const userStore = useAdminUserStore()
const userLabel = computed(() => userStore.userInfo?.real_name ?? userStore.userInfo?.username ?? 'User')
</script>

<template>
  <AdminLayout :menu-groups="accessStore.menuGroups" :route-records="accessStore.navigationRoutes" scroll-mode="document" :sticky-header="true">
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
              label: `角色：${userStore.roles.join(', ') || '-'}`,
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
