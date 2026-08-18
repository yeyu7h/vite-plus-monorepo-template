<script setup lang="ts">
import { Page } from '@monorepo-admin-core/common-ui'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

defineOptions({ name: 'IFrameRouterView' })

const props = defineProps<{
  src: string
  title?: string
}>()

const IFRAME_LOAD_TIMEOUT = 15_000
const loading = ref(true)
const loadTimedOut = ref(false)
const reloadKey = ref(0)
const iframeSrc = computed(() => props.src.trim())
const iframeTitle = computed(() => props.title || '内嵌页面')
let loadTimeout: ReturnType<typeof setTimeout> | undefined

function clearLoadTimeout() {
  if (loadTimeout !== undefined) {
    clearTimeout(loadTimeout)
    loadTimeout = void 0
  }
}

function startLoading() {
  clearLoadTimeout()
  loading.value = true
  loadTimedOut.value = false

  if (!iframeSrc.value) return

  loadTimeout = setTimeout(() => {
    if (loading.value) {
      loadTimedOut.value = true
    }
  }, IFRAME_LOAD_TIMEOUT)
}

function handleLoad() {
  clearLoadTimeout()
  loading.value = false
  loadTimedOut.value = false
}

function reloadIframe() {
  reloadKey.value += 1
  startLoading()
}

watch(iframeSrc, startLoading, { immediate: true })
onBeforeUnmount(clearLoadTimeout)
</script>

<template>
  <Page fill-height>
    <div v-if="iframeSrc" class="relative min-h-0 flex-1 overflow-hidden bg-default">
      <div v-if="loading" class="absolute inset-0 z-10 grid place-items-center bg-default">
        <div v-if="loadTimedOut" class="mx-6 max-w-lg text-center" role="alert">
          <UIcon name="i-lucide-triangle-alert" class="mx-auto size-8 text-warning" aria-hidden="true" />
          <h2 class="mt-3 text-base font-semibold text-highlighted">页面暂未完成加载</h2>
          <p class="mt-2 text-sm text-muted">目标页面可能加载较慢，或不允许在当前系统中内嵌显示。</p>
          <div class="mt-5 flex flex-wrap justify-center gap-2">
            <UButton icon="i-lucide-refresh-cw" @click="reloadIframe">重新加载</UButton>
            <UButton :to="iframeSrc" target="_blank" rel="noopener noreferrer" color="neutral" variant="outline" trailing-icon="i-lucide-external-link"> 在新窗口打开 </UButton>
          </div>
        </div>

        <div v-else role="status" aria-live="polite">
          <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-muted" aria-hidden="true" />
          <span class="sr-only">正在加载{{ iframeTitle }}</span>
        </div>
      </div>

      <iframe :key="reloadKey" :src="iframeSrc" :title="iframeTitle" class="size-full border-0 bg-default" @load="handleLoad" />
    </div>
  </Page>
</template>
