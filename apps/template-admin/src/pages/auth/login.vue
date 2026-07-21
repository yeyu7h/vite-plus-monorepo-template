<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAdminAccessStore } from '@/stores/access'
import { useAdminUserStore } from '@/stores/user'
import { resolvePostLoginPath } from '@/router/access'

definePage({
  meta: {
    initial: true,
    layout: false,
    source: 'core',
    ignoreAccess: true,
    hideInMenu: true,
    title: '登录',
  },
})

const route = useRoute()
const router = useRouter()
const accessStore = useAdminAccessStore()
const userStore = useAdminUserStore()
const username = ref('admin')
const password = ref('admin123')
const loading = ref(false)
const errorMessage = ref('')

async function handleLogin() {
  loading.value = true
  errorMessage.value = ''

  try {
    await accessStore.login({ password: password.value, username: username.value })
    const redirect = resolvePostLoginPath(route.query.redirect, {
      canAccessPath: accessStore.canAccessPath,
      fallbackPath: accessStore.resolveAccessiblePath(userStore.homePath),
    })
    await router.replace(redirect)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '登录失败'
  } finally {
    loading.value = false
  }
}

function useDemoAccount(type: 'admin' | 'user') {
  username.value = type
  password.value = type === 'admin' ? 'admin123' : 'user123'
}
</script>

<template>
  <main class="grid min-h-screen place-items-center bg-muted/30 px-4">
    <UCard class="w-full max-w-sm shadow-lg">
      <template #header>
        <div>
          <h1 class="text-xl font-semibold text-highlighted">Template Admin</h1>
          <p class="mt-1 text-sm text-muted">接口菜单驱动的权限路由演示</p>
        </div>
      </template>

      <form class="space-y-4" @submit.prevent="handleLogin">
        <UFormField label="用户名">
          <UInput v-model="username" autocomplete="username" />
        </UFormField>

        <UFormField label="密码">
          <UInput v-model="password" autocomplete="current-password" type="password" />
        </UFormField>

        <UAlert v-if="errorMessage" color="error" variant="soft" :title="errorMessage" />

        <UButton block :loading="loading" type="submit">登录</UButton>
      </form>

      <template #footer>
        <div class="flex items-center justify-between gap-2 text-xs text-muted">
          <span>演示账号</span>
          <div class="flex gap-2">
            <UButton size="xs" variant="ghost" @click="useDemoAccount('admin')">admin</UButton>
            <UButton size="xs" variant="ghost" @click="useDemoAccount('user')">user</UButton>
          </div>
        </div>
      </template>
    </UCard>
  </main>
</template>
