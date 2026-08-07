<script setup lang="ts">
import type { AdminMenuImageIcon, AdminMenuItem } from '@monorepo-admin-core/types'
import { computed, ref, watch } from 'vue'

defineOptions({ name: 'LayoutMenuList' })

const props = withDefaults(
  defineProps<{
    controlled?: boolean
    depth?: number
    items: AdminMenuItem[]
    openItemIds?: string[]
  }>(),
  {
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
    'group flex min-h-9 w-full items-center gap-2 rounded-md py-2 pr-2.5 text-left text-sm transition-colors',
    props.depth >= 3 ? 'pl-[13px]' : 'pl-2.5',
    item.active ? (hasChildren ? 'text-primary' : 'bg-elevated text-primary') : 'text-muted hover:bg-elevated/60 hover:text-default',
  ]
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
      <UCollapsible v-if="item.children?.length" :open="currentOpenItemIds.includes(item.id)" @update:open="updateItemOpen(item.id, $event)">
        <button type="button" :class="itemClass(item)">
          <UIcon v-if="depth < 3 && typeof item.icon === 'string' && item.icon.startsWith('i-')" :name="item.icon" class="size-5 shrink-0" />
          <picture v-else-if="depth < 3 && isMenuImageIcon(item.icon)" class="size-5 shrink-0">
            <source media="(prefers-color-scheme: dark)" :srcset="getMenuImageIcon(item.icon, 'dark')" />
            <img class="size-5 object-contain" :src="getMenuImageIcon(item.icon)" />
          </picture>
          <span class="min-w-0 flex-1 truncate">{{ item.title }}</span>
          <UIcon name="i-lucide-chevron-down" class="size-4 shrink-0 transition-transform duration-200" :class="{ '-rotate-90': !currentOpenItemIds.includes(item.id) }" />
        </button>

        <template #content>
          <div class="ml-3 border-l border-muted pt-1 pl-3">
            <LayoutMenuList :depth="depth + 1" :items="item.children" @select-leaf="selectNestedLeaf(item.id)" />
          </div>
        </template>
      </UCollapsible>

      <a v-else-if="item.externalLink" :href="item.externalLink" target="_blank" rel="noreferrer" :class="itemClass(item)" @click="selectLeafItem">
        <UIcon v-if="depth < 3 && typeof item.icon === 'string' && item.icon.startsWith('i-')" :name="item.icon" class="size-5 shrink-0" />
        <picture v-else-if="depth < 3 && isMenuImageIcon(item.icon)" class="size-5 shrink-0">
          <source media="(prefers-color-scheme: dark)" :srcset="getMenuImageIcon(item.icon, 'dark')" />
          <img class="size-5 object-contain" :src="getMenuImageIcon(item.icon)" />
        </picture>
        <span class="min-w-0 flex-1 truncate">{{ item.title }}</span>
        <UIcon name="i-lucide-external-link" class="size-3.5 shrink-0" />
      </a>

      <RouterLink v-else :to="item.path" :class="itemClass(item)" @click="selectLeafItem">
        <UIcon v-if="depth < 3 && typeof item.icon === 'string' && item.icon.startsWith('i-')" :name="item.icon" class="size-5 shrink-0" />
        <picture v-else-if="depth < 3 && isMenuImageIcon(item.icon)" class="size-5 shrink-0">
          <source media="(prefers-color-scheme: dark)" :srcset="getMenuImageIcon(item.icon, 'dark')" />
          <img class="size-5 object-contain" :src="getMenuImageIcon(item.icon)" />
        </picture>
        <span class="min-w-0 flex-1 truncate">{{ item.title }}</span>
      </RouterLink>
    </li>
  </ul>
</template>
