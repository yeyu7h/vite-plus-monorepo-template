<script setup lang="ts">
import { AdminLayout } from '@monorepo-admin-core/layout-effect'
import { computed } from 'vue'
import { ADMIN_TAB_STORAGE_KEY } from '@/constants/storage'
import { useAdminAccessStore } from '@/stores/access'
import { useAdminAuthStore } from '@/stores/auth'
import { useAdminUserStore } from '@/stores/user'

const accessStore = useAdminAccessStore()
const authStore = useAdminAuthStore()
const userStore = useAdminUserStore()
const userLabel = computed(() => userStore.userInfo?.real_name ?? userStore.userInfo?.username ?? 'User')
</script>

<template>
  <AdminLayout :menu-groups="accessStore.menuGroups" :route-records="accessStore.navigationRoutes" :tab-storage-key="ADMIN_TAB_STORAGE_KEY">
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
              onSelect: () => authStore.logout(),
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
