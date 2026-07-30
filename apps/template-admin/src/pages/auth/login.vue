<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import type { CapErrorEvent, CapProgressEvent } from 'cap-widget'

import Cap from 'cap-widget'
import { z } from 'zod'
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAdminAccessStore } from '@/stores/access'
import { useAdminAuthStore } from '@/stores/auth'
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
const authStore = useAdminAuthStore()
const userStore = useAdminUserStore()
const errorMessage = ref('')
const captchaError = ref('')
const captchaProgress = ref(0)
const captchaStatus = ref<'error' | 'idle' | 'verified' | 'verifying'>('idle')
const captchaToken = ref('')
let captchaClient: Cap | undefined

const credentialsSchema = z.object({
  username: z.string().min(1, '请输入用户名'),
  password: z.string().min(1, '请输入密码'),
})
type Credentials = z.output<typeof credentialsSchema>

const form = reactive<Credentials>({
  username: 'admin',
  password: '123456',
})

const captchaIcon = computed(() => {
  if (captchaStatus.value === 'verified') return 'i-lucide-shield-check'
  if (captchaStatus.value === 'error') return 'i-lucide-shield-alert'
  if (captchaStatus.value === 'verifying') return 'i-lucide-loader-circle'
  return 'i-lucide-shield'
})
const captchaLabel = computed(() => {
  if (captchaStatus.value === 'verified') return '安全验证已完成'
  if (captchaStatus.value === 'error') return '安全验证失败'
  if (captchaStatus.value === 'verifying') return `正在进行安全验证 ${Math.round(captchaProgress.value)}%`
  return '点击按钮完成安全验证'
})

async function handleLogin(event: FormSubmitEvent<Credentials>) {
  if (captchaStatus.value !== 'verified' || !captchaToken.value) {
    captchaError.value = '请先完成安全验证'
    return
  }

  errorMessage.value = ''

  try {
    await authStore.authLogin(
      {
        ...event.data,
        captchaToken: captchaToken.value,
      },
      async () => {
        const redirect = resolvePostLoginPath(route.query.redirect, {
          canAccessPath: accessStore.canAccessPath,
          fallbackPath: accessStore.resolveAccessiblePath(userStore.homePath),
        })
        await router.replace(redirect)
      },
    )
  } catch (error) {
    errorMessage.value = getErrorMessage(error)
    resetCaptcha()
  }
}

function getCaptchaClient() {
  if (!captchaClient) {
    captchaClient = new Cap({ apiEndpoint: '/api/admin/auth/' })
    captchaClient.addEventListener('progress', (event: CapProgressEvent) => {
      captchaProgress.value = event.detail.progress
    })
    captchaClient.addEventListener('error', (event: CapErrorEvent) => {
      captchaStatus.value = 'error'
      captchaError.value = event.detail.message || '安全验证失败，请重试'
    })
  }

  return captchaClient
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') return error.message
  return '登录失败，请稍后重试'
}

async function verifyCaptcha() {
  if (captchaStatus.value === 'verifying' || captchaStatus.value === 'verified') return

  captchaStatus.value = 'verifying'
  captchaProgress.value = 0
  captchaToken.value = ''
  captchaError.value = ''
  errorMessage.value = ''

  try {
    const client = getCaptchaClient()
    client.reset()
    const result = await client.solve()
    if (!result.success || !result.token) throw new Error('安全验证失败，请重试')

    captchaToken.value = result.token
    captchaProgress.value = 100
    captchaStatus.value = 'verified'
  } catch (error) {
    captchaStatus.value = 'error'
    captchaError.value = getErrorMessage(error)
  }
}

function resetCaptcha() {
  captchaClient?.reset()
  captchaToken.value = ''
  captchaProgress.value = 0
  captchaStatus.value = 'idle'
}

function useDemoAccount(type: 'admin' | 'user') {
  form.username = type
  form.password = '123456'
  errorMessage.value = ''
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

      <UForm :schema="credentialsSchema" :state="form" class="space-y-1" @submit="handleLogin">
        <UFormField label="用户名" name="username" required>
          <UInput v-model="form.username" autocomplete="username" class="w-full" />
        </UFormField>

        <UFormField label="密码" name="password" required>
          <UInput v-model="form.password" autocomplete="current-password" class="w-full" type="password" />
        </UFormField>

        <UFormField label="安全验证" :error="captchaError">
          <div class="rounded-lg border border-muted bg-elevated/50 p-3">
            <div class="flex items-center gap-3">
              <div
                class="grid size-9 shrink-0 place-items-center rounded-full"
                :class="captchaStatus === 'verified' ? 'bg-success/10 text-success' : captchaStatus === 'error' ? 'bg-error/10 text-error' : 'bg-primary/10 text-primary'"
              >
                <UIcon :class="['size-5', { 'animate-spin': captchaStatus === 'verifying' }]" :name="captchaIcon" />
              </div>

              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium text-default">{{ captchaLabel }}</p>
                <p class="mt-0.5 text-xs text-muted">通过本地工作量证明确认当前操作</p>
              </div>

              <UButton
                :color="captchaStatus === 'verified' ? 'success' : 'neutral'"
                :disabled="captchaStatus === 'verified'"
                :label="captchaStatus === 'verified' ? '已验证' : captchaStatus === 'error' ? '重试' : '验证'"
                :loading="captchaStatus === 'verifying'"
                size="sm"
                type="button"
                :variant="captchaStatus === 'verified' ? 'soft' : 'outline'"
                @click="verifyCaptcha"
              />
            </div>

            <UProgress v-if="captchaStatus === 'verifying'" v-model="captchaProgress" class="mt-3" :max="100" size="xs" />
          </div>
        </UFormField>

        <UAlert v-if="errorMessage" color="error" variant="soft" :title="errorMessage" />

        <UButton block :disabled="captchaStatus !== 'verified'" :loading="authStore.loginLoading" type="submit">登录</UButton>
      </UForm>

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
