<script setup lang="ts">
import type { AdminMenuImageIcon, AdminTabItem } from '@monorepo-admin-core/types'
import { computed, nextTick, ref, watch } from 'vue'
import { cn } from '@monorepo/shared/utils'
import { useTabTransition } from './use-tab-transition'

const TAB_BASIS = '15rem'

const props = withDefaults(
  defineProps<{
    activeKey: string
    tabs: AdminTabItem[]
    widthTransition?: boolean
  }>(),
  {
    widthTransition: true,
  },
)

const emit = defineEmits<{
  close: [key: string]
  select: [key: string]
}>()

const tabTransition = useTabTransition({ onClosed: finishTabClose, tabBasis: TAB_BASIS })

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

    if (props.widthTransition) {
      for (const tab of tabs) {
        if (!previousKeys.has(tab.key)) {
          tabTransition.prepareTabOpenTransition(tab.key)
        }
      }
    }

    syncLocalTabs(tabs)

    await nextTick()

    if (props.widthTransition) {
      for (const tab of tabs) {
        if (!previousKeys.has(tab.key)) {
          tabTransition.startTabOpenTransition(tab.key)
        }
      }
    }
  },
  { immediate: true },
)

const activeTabKey = computed(() => props.activeKey)

function closeTab(key: string) {
  const index = localTabs.value.findIndex((tab) => tab.key === key)
  const tab = localTabs.value[index]
  if (!tab || !isTabClosable(tab)) return

  if (!props.widthTransition) {
    localTabs.value = localTabs.value.filter((tab) => tab.key !== key)
    emit('close', key)
    return
  }

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

function getTabStyle(key: string) {
  return tabTransition.getTabTransitionStyle(key, TAB_BASIS)
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
  <div class="flex h-full min-w-0 flex-1 overflow-x-clip overflow-y-visible">
    <div
      v-for="tab in localTabs"
      :key="tab.key"
      :class="
        cn(
          'tab-item group/tab relative flex h-full min-w-0 shrink items-center justify-center duration-200 ease-out select-none after:absolute after:inset-x-0 after:-bottom-px after:h-px after:origin-center after:scale-x-0 after:content-[\'\']',
          widthTransition ? 'transition-[flex-basis]' : 'transition-none',
          isActiveTab(tab) ? cn('is-active z-10 bg-default after:scale-x-100', tab.showActiveTabBorder ? 'after:bg-border' : 'after:bg-default') : 'hover:bg-elevated hover:dark:bg-default',
          tabTransition.closingTabIds.value.has(tab.key) && 'pointer-events-none',
        )
      "
      :style="getTabStyle(tab.key)"
      @click="selectTab(tab.key)"
      @transitionend.self="tabTransition.handleTabTransitionEnd($event, tab.key)"
    >
      <div class="flex h-full min-w-0 flex-1 items-center justify-center overflow-hidden">
        <div class="flex w-full min-w-0 items-center overflow-hidden px-3">
          <div class="tab-primary-content flex min-w-0 flex-1 items-center overflow-hidden">
            <UIcon v-if="typeof tab.icon === 'string' && tab.icon.startsWith('i-')" class="tab-leading-icon mr-2 shrink-0 text-muted group-[.is-active]/tab:text-default" :name="tab.icon" size="18" />
            <picture v-else-if="isTabImageIcon(tab.icon)" class="tab-leading-icon shrink-0">
              <source media="(prefers-color-scheme: dark)" :srcset="getTabImageIcon(tab.icon, 'dark')" />
              <img class="mr-2 size-4.5 object-contain" :src="getTabImageIcon(tab.icon)" />
            </picture>

            <span
              class="min-w-0 flex-1 overflow-hidden text-sm leading-none font-medium whitespace-nowrap text-muted [mask-image:linear-gradient(to_right,black_calc(100%_-_0.75rem),transparent)] [mask-repeat:no-repeat] group-[.is-active]/tab:text-default"
            >
              {{ tab.title }}
            </span>
          </div>

          <button
            v-if="isTabClosable(tab)"
            class="tab-close-button ml-3 flex size-5 shrink-0 items-center justify-center rounded-full text-muted hover:bg-accented hover:text-default group-[.is-active]/tab:text-default"
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

<style scoped>
.tab-item {
  container-name: admin-tab;
  container-type: inline-size;
}

@container admin-tab (max-width: 5.75rem) {
  .tab-close-button {
    display: none;
  }

  .is-active .tab-close-button {
    display: flex;
  }
}

@container admin-tab (max-width: 5.25rem) {
  .is-active .tab-leading-icon {
    display: none;
  }
}

@container admin-tab (max-width: 3.5rem) {
  .is-active .tab-primary-content {
    display: none;
  }

  .is-active .tab-close-button {
    position: absolute;
    top: 50%;
    left: 50%;
    margin: 0;
    transform: translate(-50%, -50%);
  }
}
</style>
