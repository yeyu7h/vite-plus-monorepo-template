<script setup lang="ts">
import type { AdminContentMode, AdminScrollMode } from '@monorepo-admin-core/types'
import { computed, ref, useTemplateRef, watchEffect } from 'vue'
import { isDocumentScrollLayout, resolveLayoutSidebarClass } from '../layout'

const DEFAULT_SIDEBAR_WIDTH = 250

const props = withDefaults(
  defineProps<{
    contentMode?: AdminContentMode
    scrollMode?: AdminScrollMode
  }>(),
  {
    contentMode: 'default',
    scrollMode: 'panel',
  },
)

const collapsed = ref(false)
const documentScroll = computed(() => isDocumentScrollLayout(props.contentMode, props.scrollMode))
const opened = ref(false)
const sidebarContainer = useTemplateRef<HTMLElement>('sidebarContainer')
const sidebarWidth = ref(DEFAULT_SIDEBAR_WIDTH)

watchEffect(
  (onCleanup) => {
    if (!documentScroll.value || typeof ResizeObserver === 'undefined') return

    const sidebar = sidebarContainer.value?.querySelector<HTMLElement>('[data-slot="root"]')
    if (!sidebar) return

    const updateSidebarWidth = (entry?: ResizeObserverEntry) => {
      const width = entry?.borderBoxSize[0]?.inlineSize ?? entry?.contentRect.width ?? sidebar.getBoundingClientRect().width
      if (width > 0) sidebarWidth.value = width
    }

    updateSidebarWidth()

    const resizeObserver = new ResizeObserver(([entry]) => updateSidebarWidth(entry))
    resizeObserver.observe(sidebar)
    onCleanup(() => resizeObserver.disconnect())
  },
  { flush: 'post' },
)
</script>

<template>
  <div
    ref="sidebarContainer"
    class="relative flex w-0 shrink-0"
    :class="{ 'lg:w-(--sidebar-placeholder-width)': documentScroll, 'lg:w-auto': !documentScroll }"
    :style="{ '--sidebar-placeholder-width': `${sidebarWidth}px` }"
  >
    <UDashboardSidebar
      v-model:collapsed="collapsed"
      v-model:open="opened"
      resizable
      collapsible
      :default-size="DEFAULT_SIDEBAR_WIDTH"
      :max-size="350"
      :min-size="200"
      :ui="{
        root: `bg-muted/50 dark:bg-muted/20 ${resolveLayoutSidebarClass(props.contentMode, props.scrollMode) ?? ''}`,
        handle: documentScroll ? 'lg:ml-auto' : undefined,
      }"
    >
      <template #header="{ collapsed }">
        <div class="flex justify-between items-center w-full">
          <div>Logo</div>
        </div>
      </template>

      <slot name="menu" :collapsed="collapsed" :opened="opened" />
    </UDashboardSidebar>
  </div>
</template>
