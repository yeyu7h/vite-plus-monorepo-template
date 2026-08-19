<script setup lang="ts">
import type { FallbackProps, FallbackStatus } from './types'

import { computed } from 'vue'

type FallbackAction = {
  icon: string
  kind: 'home' | 'reload'
  label: string
}

interface FallbackState {
  action?: FallbackAction
  code?: string
  description: string
  icon?: string
  iconClass: string
  title: string
}

const props = withDefaults(defineProps<FallbackProps>(), {
  homePath: '/',
  showAction: true,
  status: 'coming-soon',
})

const emit = defineEmits(['reload'])

const FALLBACK_STATES: Record<FallbackStatus, FallbackState> = {
  '403': {
    action: { icon: 'i-lucide-arrow-left', kind: 'home', label: '返回首页' },
    code: '403',
    description: '当前账号暂无权限访问此页面，请联系管理员。',
    iconClass: 'text-warning',
    title: '无访问权限',
  },
  '404': {
    action: { icon: 'i-lucide-arrow-left', kind: 'home', label: '返回首页' },
    code: '404',
    description: '你访问的页面不存在，可能已被移动或删除。',
    iconClass: 'text-muted',
    title: '页面不存在',
  },
  '500': {
    action: { icon: 'i-lucide-refresh-cw', kind: 'reload', label: '重新加载' },
    code: '500',
    description: '页面加载失败，请稍后重试。',
    iconClass: 'text-muted',
    title: '页面发生错误',
  },
  'coming-soon': {
    description: '此功能正在建设中，敬请期待。',
    icon: 'i-lucide-rocket',
    iconClass: 'text-highlighted',
    title: '敬请期待',
  },
  offline: {
    action: { icon: 'i-lucide-refresh-cw', kind: 'reload', label: '重新加载' },
    description: '请检查网络连接后重试。',
    icon: 'i-lucide-wifi-off',
    iconClass: 'text-highlighted',
    title: '网络连接已断开',
  },
}

const state = computed(() => FALLBACK_STATES[props.status])
const title = computed(() => props.title ?? state.value.title)
const description = computed(() => props.description ?? state.value.description)
</script>

<template>
  <main class="relative flex min-h-svh w-full items-center justify-center overflow-hidden bg-default px-4 py-12 sm:px-6" :data-status="props.status">
    <UEmpty class="relative z-10 w-full max-w-xl" size="xl" variant="naked" :ui="{ root: 'gap-8 p-0' }">
      <template #header>
        <div class="flex max-w-xl flex-col items-center gap-4 text-center">
          <div class="flex min-h-24 items-center justify-center" aria-hidden="true">
            <slot name="illustration">
              <img v-if="props.image" class="max-h-32 max-w-full object-contain" aria-hidden="true" :src="props.image" />
              <span v-else-if="state.code" aria-hidden="true" class="scale-y-125 text-7xl font-semibold leading-none tracking-[0.08em] sm:text-8xl" :class="state.iconClass" data-fallback-code>
                {{ state.code }}
              </span>
              <UIcon v-else-if="state.icon" aria-hidden="true" class="size-24" :class="state.iconClass" data-fallback-icon :name="state.icon" />
            </slot>
          </div>

          <h1 class="text-2xl font-semibold tracking-tight text-highlighted sm:text-3xl">
            <slot name="title">{{ title }}</slot>
          </h1>
          <p class="max-w-lg text-sm leading-6 text-muted sm:text-base">
            <slot name="description">{{ description }}</slot>
          </p>
        </div>
      </template>

      <template #body>
        <div v-if="props.showAction && ($slots.action || state.action)" class="flex justify-center">
          <slot name="action">
            <UButton v-if="state.action?.kind === 'home'" color="primary" :icon="state.action.icon" :label="state.action.label" :to="props.homePath" />
            <UButton v-else-if="state.action?.kind === 'reload'" color="primary" :icon="state.action.icon" :label="state.action.label" type="button" @click="emit('reload')" />
          </slot>
        </div>
      </template>
    </UEmpty>
  </main>
</template>
