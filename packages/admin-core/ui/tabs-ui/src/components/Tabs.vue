<script setup lang="ts">
import type { AdminMenuImageIcon, AdminTabItem } from '@monorepo-admin-core/types'
import { computed, nextTick, ref, watch } from 'vue'
import { cn } from '@monorepo/shared/utils'
import { useTabWidthTransition } from './use-tab-width-transition'

const props = defineProps<{
  activePath: string
  tabs: AdminTabItem[]
}>()

const emit = defineEmits<{
  close: [path: string]
  select: [path: string]
}>()

const tabWidthTrans = useTabWidthTransition({ onClosed: removeTab })
const localTabs = ref<AdminTabItem[]>([])

watch(
  () => props.tabs,
  async (tabs, previousTabs = []) => {
    const previousPaths = new Set(previousTabs.map((tab) => tab.path))
    const incomingPaths = new Set(tabs.map((tab) => tab.path))

    for (const tab of tabs) {
      if (!previousPaths.has(tab.path)) {
        tabWidthTrans.prepareTabOpenTransition(tab.path)
      }
    }

    localTabs.value = tabs.map((tab) => ({ ...tab }))

    await nextTick()

    for (const tab of tabs) {
      if (!previousPaths.has(tab.path)) {
        tabWidthTrans.startTabOpenTransition(tab.path)
      }
    }

    for (const tab of previousTabs) {
      if (!incomingPaths.has(tab.path)) {
        tabWidthTrans.closingTabIds.value.delete(tab.path)
      }
    }
  },
  { immediate: true },
)

const activeTabPath = computed(() => props.activePath)

function closeTab(path: string) {
  const index = localTabs.value.findIndex((tab) => tab.path === path)
  if (index === -1) return

  const tab = localTabs.value[index]
  if (!tab || !isTabClosable(tab)) return

  const started = tabWidthTrans.startTabCloseTransition(path)
  if (!started) return
}

function removeTab(path: string) {
  emit('close', path)
}

function selectTab(path: string) {
  if (path === props.activePath) return
  emit('select', path)
}

function isTabClosable(tab: AdminTabItem) {
  return localTabs.value.length > 1 && tab.closable !== false
}

function getTabImageIcon(icon: unknown, theme: 'light' | 'dark' = 'light'): string {
  const imageIcon = icon as AdminMenuImageIcon
  return theme === 'light' ? imageIcon.light : (imageIcon.dark ?? imageIcon.light)
}

function isTabImageIcon(icon: unknown): icon is AdminMenuImageIcon {
  return typeof icon === 'object' && icon !== null && 'light' in icon
}
</script>

<template>
  <div class="flex h-full">
    <div
      v-for="tab in localTabs"
      :key="tab.path"
      :ref="(el) => tabWidthTrans.setTabElement(tab.path, el as HTMLDivElement | null)"
      :class="
        cn(
          'group relative flex h-full min-w-0 shrink-0 items-center justify-center select-none transition-[width] duration-200 ease-out after:absolute after:inset-x-0 after:-bottom-px after:h-px after:origin-center after:scale-x-0 after:bg-default after:content-[\'\']',
          tab.path === activeTabPath ? 'z-10 bg-default after:scale-x-100' : 'hover:bg-elevated hover:dark:bg-default',
          tabWidthTrans.closingTabIds.value.has(tab.path) && 'pointer-events-none',
        )
      "
      :style="tabWidthTrans.getTabWidthTransitionStyle(tab.path)"
      @click="selectTab(tab.path)"
      @transitionend.self="tabWidthTrans.handleTabWidthTransitionEnd($event, tab.path)"
    >
      <div class="flex h-full min-w-0 flex-1 items-center justify-center overflow-hidden">
        <div class="flex min-w-max items-center justify-center px-3">
          <UIcon v-if="typeof tab.icon === 'string' && tab.icon.startsWith('i-')" class="mr-2 shrink-0" :name="tab.icon" size="18" />
          <picture v-else-if="isTabImageIcon(tab.icon)" class="mr-2 flex size-[18px] shrink-0 items-center justify-center">
            <source media="(prefers-color-scheme: dark)" :srcset="getTabImageIcon(tab.icon, 'dark')" />
            <img class="size-[18px] object-contain" :src="getTabImageIcon(tab.icon)" />
          </picture>

          <span class="text-sm leading-none">{{ tab.title }}</span>

          <button
            v-if="isTabClosable(tab)"
            class="ml-3 flex size-5 shrink-0 items-center justify-center rounded-full opacity-60 hover:bg-accented hover:opacity-100"
            type="button"
            title="关闭标签页"
            @click.stop="closeTab(tab.path)"
          >
            <UIcon name="i-lucide-x" size="14" />
          </button>

          <button v-else class="ml-3 flex size-5 shrink-0 cursor-default items-center justify-center rounded-full opacity-60" type="button" title="固定标签页" disabled @click.stop>
            <UIcon name="i-lucide-pin" size="14" />
          </button>
        </div>
      </div>

      <span
        aria-hidden="true"
        class="pointer-events-none absolute top-0 right-0 -bottom-px z-10 w-px bg-border transition-opacity duration-200 ease-out"
        :class="tabWidthTrans.closingTabIds.value.has(tab.path) ? 'opacity-0' : 'opacity-100'"
      />
    </div>
  </div>
</template>
