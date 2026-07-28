<script setup lang="ts">
import type { CapSolveEvent, CapWidget } from 'cap-widget'
import 'cap-widget'

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
const password = ref('123456')
const captchaToken = ref('')
const captcha = ref<CapWidget | null>(null)
const loading = ref(false)
const errorMessage = ref('')

async function handleLogin() {
  if (!captchaToken.value) {
    errorMessage.value = '请先完成人机验证'
    return
  }

  loading.value = true
  errorMessage.value = ''

  try {
    await accessStore.login({ captchaToken: captchaToken.value, password: password.value, username: username.value })
    const redirect = resolvePostLoginPath(route.query.redirect, {
      canAccessPath: accessStore.canAccessPath,
      fallbackPath: accessStore.resolveAccessiblePath(userStore.homePath),
    })
    await router.replace(redirect)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '登录失败'
    resetCaptcha()
  } finally {
    loading.value = false
  }
}

function handleCaptchaSolve(event: CapSolveEvent) {
  captchaToken.value = event.detail.token
  errorMessage.value = ''
}

function handleCaptchaError() {
  resetCaptcha()
  errorMessage.value = '人机验证失败，请重试'
}

function resetCaptcha() {
  captchaToken.value = ''
  captcha.value?.reset()
}

function useDemoAccount(type: 'admin' | 'user') {
  username.value = type
  password.value = '123456'
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

        <div class="space-y-1">
          <cap-widget
            ref="captcha"
            required
            aria-label="人机验证"
            data-cap-api-endpoint="/api/admin/auth/"
            data-cap-i18n-error-aria-label="人机验证发生错误，请重试"
            data-cap-i18n-error-label="验证失败，请重试"
            data-cap-i18n-initial-state="确认你是真人"
            data-cap-i18n-required-label="请先完成人机验证"
            data-cap-i18n-solved-label="验证成功"
            data-cap-i18n-verified-aria-label="已完成人机验证"
            data-cap-i18n-verifying-aria-label="正在验证，请稍候"
            data-cap-i18n-verifying-label="正在验证…"
            data-cap-i18n-verify-aria-label="点击确认你是真人"
            @error="handleCaptchaError"
            @reset="captchaToken = ''"
            @solve="handleCaptchaSolve"
          />
          <p class="text-xs text-muted">请先完成人机验证后再登录</p>
        </div>

        <UAlert v-if="errorMessage" color="error" variant="soft" :title="errorMessage" />

        <UButton block :disabled="!captchaToken" :loading="loading" type="submit">登录</UButton>
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
