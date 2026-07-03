<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { cn } from '@monorepo/shared/utils'
import { useTabWidthTransition } from './use-tab-width-transition'

interface TabItem {
  id: string
  title: string
  icon: string
  refreshedAt?: number
}

const tabs = ref<TabItem[]>([
  { id: 'guide', title: 'Guide', icon: 'i-lucide-box' },
  { id: 'settings', title: '设置', icon: 'i-lucide-settings' },
  { id: 'colors', title: 'Colors', icon: 'i-lucide-palette' },
  { id: 'theme', title: 'Theme', icon: 'i-lucide-swatch-book' },
])

const tabWidthTrans = useTabWidthTransition({ onClosed: removeTab })

const activeTabId = ref('settings')
const newTabIndex = ref(1)

function closeTab(id: string) {
  if (tabs.value.length <= 1) return

  const index = tabs.value.findIndex((tab) => tab.id === id)
  if (index === -1) return

  const started = tabWidthTrans.startTabCloseTransition(id)
  if (!started) return

  if (activeTabId.value === id) {
    const nextTab = tabs.value[index + 1] ?? tabs.value[index - 1]
    if (nextTab) activeTabId.value = nextTab.id
  }
}

function removeTab(id: string) {
  const index = tabs.value.findIndex((tab) => tab.id === id)
  if (index !== -1) tabs.value.splice(index, 1)
}

async function addTab() {
  const id = `new-${newTabIndex.value}`

  tabWidthTrans.prepareTabOpenTransition(id)
  tabs.value.push({ id, title: `New ${newTabIndex.value}`, icon: 'i-lucide-file' })
  newTabIndex.value += 1

  await nextTick()
  tabWidthTrans.startTabOpenTransition(id)
  requestAnimationFrame(() => (activeTabId.value = id))
}
</script>

<template>
  <div class="flex h-full">
    <div
      v-for="tab in tabs"
      :key="tab.id"
      :ref="(el) => tabWidthTrans.setTabElement(tab.id, el as HTMLDivElement | null)"
      :class="
        cn(
          'group relative flex h-full min-w-0 shrink-0 items-center justify-center select-none transition-[width] duration-200 ease-out after:absolute after:inset-x-0 after:-bottom-px after:h-px after:origin-center after:scale-x-0 after:bg-default after:content-[\'\']',
          tab.id === activeTabId ? 'z-10 bg-default after:scale-x-100' : 'hover:bg-elevated hover:dark:bg-default',
          tabWidthTrans.closingTabIds.value.has(tab.id) && 'pointer-events-none',
        )
      "
      :style="tabWidthTrans.getTabWidthTransitionStyle(tab.id)"
      @click="activeTabId = tab.id"
      @transitionend.self="tabWidthTrans.handleTabWidthTransitionEnd($event, tab.id)"
    >
      <div class="flex h-full min-w-0 flex-1 items-center justify-center overflow-hidden">
        <div class="flex min-w-max items-center justify-center px-3">
          <UIcon class="mr-2 shrink-0" :name="tab.icon" size="18" />

          <span class="text-sm leading-none">{{ tab.title }}</span>

          <button class="ml-3 flex size-5 shrink-0 items-center justify-center rounded-full opacity-60 hover:bg-accented hover:opacity-100" type="button" @click.stop="closeTab(tab.id)">
            <UIcon name="i-lucide-x" size="14" />
          </button>
        </div>
      </div>

      <span
        aria-hidden="true"
        class="pointer-events-none absolute top-0 right-0 -bottom-px z-10 w-px bg-border transition-opacity duration-200 ease-out"
        :class="tabWidthTrans.closingTabIds.value.has(tab.id) ? 'opacity-0' : 'opacity-100'"
      />
    </div>

    <button class="flex h-full w-10 shrink-0 items-center justify-center border-r border-default select-none hover:bg-elevated hover:dark:bg-default" type="button" @click="addTab">
      <UIcon name="i-lucide-plus" size="20" />
    </button>
  </div>
</template>
