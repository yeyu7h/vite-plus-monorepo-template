import type { AdminUserInfo } from '@/api/auth'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { DEFAULT_ADMIN_HOME_PATH, normalizeAdminPath } from '@/router/access'

export const useAdminUserStore = defineStore('admin-user', () => {
  const userInfo = ref<AdminUserInfo | null>(null)

  const roles = computed(() => userInfo.value?.roles ?? [])
  const homePath = computed(() => normalizeAdminPath(userInfo.value?.home_path ?? DEFAULT_ADMIN_HOME_PATH))

  function setUserInfo(nextUserInfo: AdminUserInfo) {
    userInfo.value = nextUserInfo
  }

  function clearUser() {
    userInfo.value = null
  }

  return {
    clearUser,
    homePath,
    roles,
    setUserInfo,
    userInfo,
  }
})
