<script setup lang="ts">
import type { AdminMenuGroup } from '@monorepo-admin-core/types'
import { computed, ref, watch } from 'vue'
import LayoutMenuList from './MenuList.vue'

const props = defineProps<{
  collapsed: boolean
  groups: AdminMenuGroup[]
  opened: boolean
}>()

const isMenuCollapsed = computed(() => props.collapsed && !props.opened)
const activeRootItemId = computed(() => props.groups.flatMap((group) => group.children).find((item) => item.active && item.children?.length)?.id)
const openedRootItemIds = ref<string[]>([])

watch(
  activeRootItemId,
  (itemId) => {
    if (itemId && !openedRootItemIds.value.includes(itemId)) openedRootItemIds.value = [...openedRootItemIds.value, itemId]
  },
  { immediate: true },
)
</script>

<template>
  <nav aria-label="主导航" data-menu-mode="single">
    <section v-for="(group, groupIndex) in groups" :key="group.id" :class="{ 'mt-4': groupIndex > 0 }">
      <div
        v-if="groupIndex > 0"
        aria-hidden="true"
        data-menu-separator
        class="ms-1 mb-4 border-t border-default transition-[width] duration-200"
        :class="isMenuCollapsed ? 'w-6' : 'w-[calc(100%-0.25rem)]'"
      />
      <p
        v-if="group.label"
        class="overflow-hidden pl-1 pr-6 text-xs font-medium whitespace-nowrap text-dimmed transition-[max-height,padding,opacity] duration-200"
        :class="isMenuCollapsed ? 'max-h-0 pb-0 opacity-0' : 'max-h-6 pb-1 opacity-100'"
      >
        {{ group.label }}
      </p>
      <LayoutMenuList v-model:open-item-ids="openedRootItemIds" :collapsed="isMenuCollapsed" controlled :items="group.children" />
    </section>
  </nav>
</template>
