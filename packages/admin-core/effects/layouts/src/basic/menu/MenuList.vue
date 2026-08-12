<script setup lang="ts">
import type { AdminMenuImageIcon, AdminMenuItem } from '@monorepo-admin-core/types'
import { computed, ref, watch } from 'vue'

defineOptions({ name: 'LayoutMenuList' })

const props = withDefaults(
  defineProps<{
    collapsed?: boolean
    controlled?: boolean
    depth?: number
    items: AdminMenuItem[]
    openItemIds?: string[]
  }>(),
  {
    collapsed: false,
    controlled: false,
    depth: 1,
    openItemIds: () => [],
  },
)

const emit = defineEmits<{
  selectLeaf: []
  'update:openItemIds': [value: string[]]
}>()

const internalOpenItemIds = ref<string[]>([])
const activeItemIds = computed(() => props.items.filter((item) => item.active).map((item) => item.id))
const activeOpenItemIds = computed(() => props.items.filter((item) => item.active && item.children?.length).map((item) => item.id))
const currentOpenItemIds = computed(() => (props.controlled ? props.openItemIds : internalOpenItemIds.value))
const isRootCollapsed = computed(() => props.collapsed && props.depth === 1)

watch(
  activeItemIds,
  (itemIds) => {
    if (itemIds.length > 0) setOpenItemIds(activeOpenItemIds.value)
  },
  { immediate: true },
)

function setOpenItemIds(itemIds: string[]) {
  internalOpenItemIds.value = itemIds
  emit('update:openItemIds', itemIds)
}

function updateItemOpen(itemId: string, open: boolean) {
  setOpenItemIds(open ? [...new Set([...currentOpenItemIds.value, itemId])] : currentOpenItemIds.value.filter((id) => id !== itemId))
}

function selectLeafItem() {
  setOpenItemIds([])
  emit('selectLeaf')
}

function selectNestedLeaf(itemId: string) {
  setOpenItemIds([itemId])
  emit('selectLeaf')
}

function itemClass(item: AdminMenuItem) {
  const hasChildren = Boolean(item.children?.length)

  return [
    'group relative isolate flex w-full items-center rounded-md py-1.5 text-left text-sm font-medium transition-[gap,padding,color,background-color] duration-200 focus:outline-none focus-visible:outline-3 focus-visible:outline-primary/25',
    isRootCollapsed.value ? 'gap-0 px-1.5' : ['gap-1.5 pr-2.5', props.depth === 1 ? 'pl-1.5' : props.depth >= 3 ? 'pl-2.75' : 'pl-2.5'],
    item.active
      ? isRootCollapsed.value
        ? "text-primary before:pointer-events-none before:absolute before:top-1/2 before:left-1/2 before:z-0 before:size-8 before:-translate-x-1/2 before:-translate-y-1/2 before:rounded-md before:bg-elevated before:content-['']"
        : hasChildren
          ? 'text-primary hover:bg-elevated/50'
          : 'bg-elevated text-primary'
      : 'text-muted hover:bg-elevated/50 hover:text-highlighted',
  ]
}

function leadingIconClass(item: AdminMenuItem) {
  return ['relative z-10 size-5 shrink-0 transition-colors', item.active ? undefined : 'text-dimmed group-hover:text-default']
}

function getMenuImageIcon(icon: AdminMenuImageIcon, theme: 'light' | 'dark' = 'light'): string {
  return theme === 'light' ? icon.light : (icon.dark ?? icon.light)
}

function isMenuImageIcon(icon: unknown): icon is AdminMenuImageIcon {
  return typeof icon === 'object' && icon !== null && 'light' in icon
}
</script>

<template>
  <ul class="space-y-1">
    <li v-for="item in items" :key="item.id">
      <UCollapsible v-if="item.children?.length" :open="!isRootCollapsed && currentOpenItemIds.includes(item.id)" @update:open="updateItemOpen(item.id, $event)">
        <button type="button" :aria-label="isRootCollapsed ? item.title : undefined" :title="isRootCollapsed ? item.title : undefined" :class="itemClass(item)">
          <UIcon v-if="depth < 3 && typeof item.icon === 'string' && item.icon.startsWith('i-')" :name="item.icon" :class="leadingIconClass(item)" />
          <picture v-else-if="depth < 3 && isMenuImageIcon(item.icon)" class="relative z-10 size-5 shrink-0">
            <source media="(prefers-color-scheme: dark)" :srcset="getMenuImageIcon(item.icon, 'dark')" />
            <img class="size-5 object-contain" :src="getMenuImageIcon(item.icon)" />
          </picture>
          <UIcon v-else-if="isRootCollapsed" name="i-lucide-circle" :class="leadingIconClass(item)" />
          <span
            class="overflow-hidden truncate whitespace-nowrap transition-[max-width,opacity] duration-200"
            :class="isRootCollapsed ? 'max-w-0 flex-none opacity-0' : 'min-w-0 max-w-40 flex-1 opacity-100'"
          >
            {{ item.title }}
          </span>
          <span
            aria-hidden="true"
            class="flex shrink-0 items-center justify-center overflow-hidden transition-[width,opacity] duration-200"
            :class="isRootCollapsed ? 'w-0 opacity-0' : 'ms-auto w-4 opacity-100'"
          >
            <UIcon
              name="i-lucide-chevron-down"
              class="size-4 shrink-0 transition-transform duration-200 ease-out"
              :style="{ transform: currentOpenItemIds.includes(item.id) ? 'rotate(0deg)' : 'rotate(-90deg)' }"
            />
          </span>
        </button>

        <template #content>
          <div
            data-menu-children
            class="pt-1"
            :class="!isRootCollapsed && currentOpenItemIds.includes(item.id) ? 'animate-[fade-in_150ms_ease-out] opacity-100' : 'animate-[fade-out_150ms_ease-out] opacity-0'"
          >
            <div class="border-l border-default pl-1.25" :class="depth === 1 ? 'ml-4' : 'ml-5'">
              <LayoutMenuList :depth="depth + 1" :items="item.children" @select-leaf="selectNestedLeaf(item.id)" />
            </div>
          </div>
        </template>
      </UCollapsible>

      <a
        v-else-if="item.externalLink"
        :aria-label="isRootCollapsed ? item.title : undefined"
        :href="item.externalLink"
        target="_blank"
        rel="noreferrer"
        :title="isRootCollapsed ? item.title : undefined"
        :class="itemClass(item)"
        @click="selectLeafItem"
      >
        <UIcon v-if="depth < 3 && typeof item.icon === 'string' && item.icon.startsWith('i-')" :name="item.icon" :class="leadingIconClass(item)" />
        <picture v-else-if="depth < 3 && isMenuImageIcon(item.icon)" class="relative z-10 size-5 shrink-0">
          <source media="(prefers-color-scheme: dark)" :srcset="getMenuImageIcon(item.icon, 'dark')" />
          <img class="size-5 object-contain" :src="getMenuImageIcon(item.icon)" />
        </picture>
        <UIcon v-else-if="isRootCollapsed" name="i-lucide-circle" :class="leadingIconClass(item)" />
        <span
          data-menu-external-label
          class="min-w-0 overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-200"
          :class="isRootCollapsed ? 'max-w-0 flex-none opacity-0' : 'max-w-40 flex-1 opacity-100'"
        >
          <span data-menu-external-content class="inline-flex max-w-full min-w-0 items-start align-top">
            <span data-menu-label-text class="min-w-0 truncate">{{ item.title }}</span>
            <UIcon name="i-lucide-arrow-up-right" aria-hidden="true" class="ms-0.5 size-3 shrink-0 text-dimmed" />
          </span>
        </span>
      </a>

      <RouterLink v-else :aria-label="isRootCollapsed ? item.title : undefined" :title="isRootCollapsed ? item.title : undefined" :to="item.path" :class="itemClass(item)" @click="selectLeafItem">
        <UIcon v-if="depth < 3 && typeof item.icon === 'string' && item.icon.startsWith('i-')" :name="item.icon" :class="leadingIconClass(item)" />
        <picture v-else-if="depth < 3 && isMenuImageIcon(item.icon)" class="relative z-10 size-5 shrink-0">
          <source media="(prefers-color-scheme: dark)" :srcset="getMenuImageIcon(item.icon, 'dark')" />
          <img class="size-5 object-contain" :src="getMenuImageIcon(item.icon)" />
        </picture>
        <UIcon v-else-if="isRootCollapsed" name="i-lucide-circle" :class="leadingIconClass(item)" />
        <span
          class="overflow-hidden truncate whitespace-nowrap transition-[max-width,opacity] duration-200"
          :class="isRootCollapsed ? 'max-w-0 flex-none opacity-0' : 'min-w-0 max-w-40 flex-1 opacity-100'"
        >
          {{ item.title }}
        </span>
      </RouterLink>
    </li>
  </ul>
</template>
