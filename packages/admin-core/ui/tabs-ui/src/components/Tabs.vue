<script setup lang="ts">
import type { AdminMenuImageIcon, AdminTabItem } from '@monorepo-admin-core/types'
import { computed, nextTick, ref, watch } from 'vue'
import { cn } from '@monorepo/shared/utils'
import { useTabTransition } from './use-tab-transition'

const props = defineProps<{
  activeKey: string
  tabs: AdminTabItem[]
}>()

const emit = defineEmits<{
  close: [key: string]
  select: [key: string]
}>()

const tabTransition = useTabTransition({ onClosed: finishTabClose })

const hasHydratedTabs = ref(false)
const localTabs = ref<AdminTabItem[]>([])
const pendingCloseTabIds = ref<Record<string, true>>({})
const logicalTabCount = computed(() => localTabs.value.filter((tab) => !pendingCloseTabIds.value[tab.key]).length)

watch(
  () => props.tabs,
  async (tabs, previousTabs = []) => {
    if (!hasHydratedTabs.value) {
      localTabs.value = tabs.map((tab) => ({ ...tab }))
      hasHydratedTabs.value = true
      return
    }

    const previousKeys = new Set(previousTabs.map((tab) => tab.key))

    for (const tab of tabs) {
      if (!previousKeys.has(tab.key)) {
        tabTransition.prepareTabOpenTransition(tab.key)
      }
    }

    syncLocalTabs(tabs)

    await nextTick()

    for (const tab of tabs) {
      if (!previousKeys.has(tab.key)) {
        tabTransition.startTabOpenTransition(tab.key)
      }
    }
  },
  { immediate: true },
)

const activeTabKey = computed(() => props.activeKey)

function closeTab(key: string) {
  const index = localTabs.value.findIndex((tab) => tab.key === key)
  if (index === -1) return

  const tab = localTabs.value[index]
  if (!tab || !isTabClosable(tab)) return

  const started = tabTransition.startTabCloseTransition(key)
  if (!started) return

  pendingCloseTabIds.value = {
    ...pendingCloseTabIds.value,
    [key]: true,
  }

  emit('close', key)
}

function finishTabClose(key: string) {
  const { [key]: _removedTabId, ...nextPendingCloseTabIds } = pendingCloseTabIds.value
  pendingCloseTabIds.value = nextPendingCloseTabIds
  localTabs.value = localTabs.value.filter((tab) => tab.key !== key)
}

function selectTab(key: string) {
  if (key === props.activeKey) return
  emit('select', key)
}

function isTabClosable(tab: AdminTabItem) {
  if (tab.closable === false) return false
  if (pendingCloseTabIds.value[tab.key]) return true

  return logicalTabCount.value > 1
}

function isActiveTab(tab: AdminTabItem) {
  return tab.key === activeTabKey.value
}

function getTabImageIcon(icon: unknown, theme: 'light' | 'dark' = 'light'): string {
  const imageIcon = icon as AdminMenuImageIcon
  return theme === 'light' ? imageIcon.light : (imageIcon.dark ?? imageIcon.light)
}

function isTabImageIcon(icon: unknown): icon is AdminMenuImageIcon {
  return typeof icon === 'object' && icon !== null && 'light' in icon
}

function syncLocalTabs(tabs: AdminTabItem[]) {
  const nextTabsByKey = new Map(tabs.map((tab) => [tab.key, { ...tab }]))
  const nextLocalTabs: AdminTabItem[] = []

  for (const currentTab of localTabs.value) {
    const nextTab = nextTabsByKey.get(currentTab.key)
    if (nextTab) {
      nextLocalTabs.push(nextTab)
      nextTabsByKey.delete(currentTab.key)
      continue
    }

    if (pendingCloseTabIds.value[currentTab.key]) {
      nextLocalTabs.push(currentTab)
    }
  }

  const renderedKeys = new Set(nextLocalTabs.map((tab) => tab.key))

  for (const tab of tabs) {
    if (renderedKeys.has(tab.key)) continue
    nextLocalTabs.push({ ...tab })
  }

  localTabs.value = nextLocalTabs
}
</script>

<template>
  <div class="flex h-full">
    <div
      v-for="tab in localTabs"
      :key="tab.key"
      :ref="(el) => tabTransition.setTabElement(tab.key, el as HTMLDivElement | null)"
      :class="
        cn(
          'group/tab relative flex h-full min-w-0 shrink-0 items-center justify-center select-none transition-[width] duration-200 ease-out after:absolute after:inset-x-0 after:-bottom-px after:h-px after:origin-center after:scale-x-0 after:content-[\'\']',
          isActiveTab(tab) ? cn('is-active z-10 bg-default after:scale-x-100', tab.showActiveTabBorder ? 'after:bg-border' : 'after:bg-default') : 'hover:bg-elevated hover:dark:bg-default',
          tabTransition.closingTabIds.value.has(tab.key) && 'pointer-events-none',
        )
      "
      :style="tabTransition.getTabTransitionStyle(tab.key)"
      @click="selectTab(tab.key)"
      @transitionend.self="tabTransition.handleTabTransitionEnd($event, tab.key)"
    >
      <div class="flex h-full min-w-0 flex-1 items-center justify-center overflow-hidden">
        <div class="flex min-w-max items-center justify-center px-3">
          <UIcon v-if="typeof tab.icon === 'string' && tab.icon.startsWith('i-')" class="mr-2 shrink-0 text-muted group-[.is-active]/tab:text-default" :name="tab.icon" size="18" />
          <picture v-else-if="isTabImageIcon(tab.icon)">
            <source media="(prefers-color-scheme: dark)" :srcset="getTabImageIcon(tab.icon, 'dark')" />
            <img class="mr-2 size-4.5 object-contain" :src="getTabImageIcon(tab.icon)" />
          </picture>

          <span class="text-sm leading-none font-medium text-muted group-[.is-active]/tab:text-default">{{ tab.title }}</span>

          <button
            v-if="isTabClosable(tab)"
            class="ml-3 flex size-5 shrink-0 items-center justify-center rounded-full text-muted hover:bg-accented hover:text-default group-[.is-active]/tab:text-default"
            type="button"
            title="关闭标签页"
            @click.stop="closeTab(tab.key)"
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
        :class="tabTransition.closingTabIds.value.has(tab.key) ? 'opacity-0' : 'opacity-100'"
      />
    </div>
  </div>
</template>
