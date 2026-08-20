<script setup lang="ts">
import type { LayoutProps } from './layout'

import { onBeforeUnmount, onMounted, ref } from 'vue'
import { LayoutHeader, LayoutSidebar, LayoutTabbar } from './components'

import { useLayout } from './hooks/use-layout'

const props = withDefaults(defineProps<LayoutProps>(), { tabbarEnable: true })

const { tabbar } = useLayout(props)
const sidebarCollapsed = ref(false)
const headerElevated = ref(false)

function updateHeaderElevation() {
  const scrollTop = Math.max(window.scrollY, document.scrollingElement?.scrollTop ?? 0, document.documentElement.scrollTop)
  const elevated = scrollTop > 20
  if (headerElevated.value !== elevated) headerElevated.value = elevated
}

onMounted(() => {
  updateHeaderElevation()
  document.addEventListener('scroll', updateHeaderElevation, { passive: true })
})

onBeforeUnmount(() => document.removeEventListener('scroll', updateHeaderElevation))
</script>

<template>
  <div class="relative flex min-h-svh w-full bg-default">
    <LayoutSidebar @update:collapsed="sidebarCollapsed = $event">
      <template #menu="{ collapsed, opened, setOverlayOpen }">
        <slot name="menu" :collapsed="collapsed" :opened="opened" :set-overlay-open="setOverlayOpen" />
      </template>

      <template #footer="{ collapsed, opened, setOverlayOpen }">
        <slot name="footer" :collapsed="collapsed" :opened="opened" :set-overlay-open="setOverlayOpen" />
      </template>
    </LayoutSidebar>

    <div class="min-w-0 flex-1">
      <div
        data-layout-header-wrapper
        class="fixed inset-x-0 top-0 z-10 transition-[inset-inline-start,box-shadow] duration-200 ease-out"
        :class="[sidebarCollapsed ? 'lg:inset-s-16' : 'lg:inset-s-60', headerElevated && 'shadow-[0_16px_24px_var(--ui-bg)]']"
      >
        <slot name="header">
          <LayoutHeader>
            <template v-if="$slots['header-toggle']" #toggle="slotProps">
              <slot name="header-toggle" v-bind="slotProps" />
            </template>

            <template v-if="$slots['header-left']" #left="slotProps">
              <slot name="header-left" v-bind="slotProps" />
            </template>

            <template v-if="$slots['header-right']" #right="slotProps">
              <slot name="header-right" v-bind="slotProps" />
            </template>
          </LayoutHeader>
        </slot>

        <LayoutTabbar v-if="tabbar">
          <slot name="tabbar" />
        </LayoutTabbar>
      </div>

      <div aria-hidden="true" class="shrink-0" :class="tabbar ? 'h-[calc(var(--ui-header-height)+2.5rem)]' : 'h-(--ui-header-height)'" />

      <main
        class="isolate relative flex min-w-0 flex-col"
        :class="
          tabbar
            ? 'h-[calc(100svh-var(--ui-header-height)-2.5rem)] min-h-[calc(100svh-var(--ui-header-height)-2.5rem)]'
            : 'h-[calc(100svh-var(--ui-header-height))] min-h-[calc(100svh-var(--ui-header-height))]'
        "
      >
        <slot />
      </main>
    </div>
  </div>
</template>
