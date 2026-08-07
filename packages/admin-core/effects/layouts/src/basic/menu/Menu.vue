<script setup lang="ts">
import type { AdminMenuGroup, AdminMenuImageIcon, AdminMenuItem } from '@monorepo-admin-core/types'
import type { NavigationMenuItem } from '@nuxt/ui'
import { computed, ref, watch } from 'vue'
import LayoutMenuList from './MenuList.vue'

interface LayoutNavigationMenuItem extends NavigationMenuItem {
  menu?: AdminMenuItem
  menuIcon?: AdminMenuItem['icon']
}

const props = defineProps<{
  collapsed: boolean
  groups: AdminMenuGroup[]
  opened: boolean
}>()

const isMenuCollapsed = computed(() => props.collapsed && !props.opened)
const navigationItems = computed<LayoutNavigationMenuItem[][]>(() => props.groups.map(toNavigationMenuGroup).filter((group) => group.length > 0))
const activeRootItemId = computed(() => props.groups.flatMap((group) => group.children).find((item) => item.active && item.children?.length)?.id)
const openedRootItemIds = ref<string[]>([])

watch(
  activeRootItemId,
  (itemId) => {
    if (itemId && !openedRootItemIds.value.includes(itemId)) openedRootItemIds.value = [...openedRootItemIds.value, itemId]
  },
  { immediate: true },
)

function toNavigationMenuGroup(group: AdminMenuGroup): LayoutNavigationMenuItem[] {
  return [
    ...(group.label
      ? [
          {
            label: group.label,
            type: 'label' as const,
          },
        ]
      : []),
    ...group.children.map(toNavigationMenuItem),
  ]
}

function toNavigationMenuItem(menu: AdminMenuItem): LayoutNavigationMenuItem {
  const hasChildren = Boolean(menu.children?.length)
  const icon = typeof menu.icon === 'string' ? menu.icon : void 0

  return {
    active: menu.active,
    children: menu.children?.map(toNavigationMenuItem),
    icon,
    label: menu.title,
    menu,
    menuIcon: menu.icon,
    target: menu.externalLink ? '_blank' : void 0,
    to: menu.externalLink ?? menu.path,
    type: hasChildren ? 'trigger' : void 0,
    value: menu.id,
  }
}

function getMenuImageIcon(icon: unknown, theme: 'light' | 'dark' = 'light'): string {
  const imageIcon = icon as AdminMenuImageIcon
  return theme === 'light' ? imageIcon.light : (imageIcon.dark ?? imageIcon.light)
}

function isMenuImageIcon(icon: unknown): icon is AdminMenuImageIcon {
  return typeof icon === 'object' && icon !== null && 'light' in icon
}
</script>

<template>
  <UNavigationMenu v-if="isMenuCollapsed" collapsed :items="navigationItems" popover :highlight="false" type="single" orientation="vertical" :ui="{ list: 'space-y-1', childList: 'space-y-1 pt-1' }">
    <template #item-leading="{ item }">
      <UIcon v-if="typeof item.menuIcon === 'string' && item.menuIcon.startsWith('i-')" class="font-bold text-dimmed" :class="{ 'text-primary': item.active }" :name="item.menuIcon" size="20" />
      <picture v-else-if="item.type !== 'label' && isMenuImageIcon(item.menuIcon)">
        <source media="(prefers-color-scheme: dark)" :srcset="getMenuImageIcon(item.menuIcon, 'dark')" />
        <img class="w-5 h-5 object-cover" :src="getMenuImageIcon(item.menuIcon)" />
      </picture>
    </template>

    <template #item-content="{ item }">
      <div class="min-w-56 p-1">
        <LayoutMenuList :depth="2" :items="item.menu?.children ?? []" />
      </div>
    </template>
  </UNavigationMenu>

  <nav v-else aria-label="主导航" class="space-y-4">
    <section v-for="group in groups" :key="group.id">
      <p v-if="group.label" class="px-2.5 pb-1 text-xs font-medium text-dimmed">{{ group.label }}</p>
      <LayoutMenuList v-model:open-item-ids="openedRootItemIds" controlled :items="group.children" />
    </section>
  </nav>
</template>
