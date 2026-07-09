<script setup lang="ts">
import type { AdminMenuGroup, AdminMenuImageIcon, AdminMenuItem } from '@monorepo-admin-core/types'
import type { NavigationMenuItem } from '@nuxt/ui'
import { computed, nextTick, onMounted, ref, watch } from 'vue'

interface LayoutNavigationMenuItem extends NavigationMenuItem {
  menuIcon?: AdminMenuItem['icon']
}

const props = defineProps<{
  collapsed: boolean
  groups: AdminMenuGroup[]
  opened: boolean
}>()

const isMenuCollapsed = computed(() => props.collapsed && !props.opened)
const navigationItems = computed<LayoutNavigationMenuItem[][]>(() => props.groups.map(toNavigationMenuGroup).filter((group) => group.length > 0))
const activeMenuValue = computed(() => findExpandedMenuValue(props.groups))
const openedMenuValue = ref<string | undefined>()

watch(activeMenuValue, (value) => {
  openedMenuValue.value = value
})

onMounted(async () => {
  const value = activeMenuValue.value
  if (!value) return

  openedMenuValue.value = void 0
  await nextTick()
  requestAnimationFrame(() => {
    openedMenuValue.value = value
  })
})

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
    class: hasChildren && menu.active && !isMenuCollapsed.value ? 'before:!bg-transparent hover:before:!bg-elevated/50' : void 0,
    icon,
    label: menu.title,
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

function findExpandedMenuValue(groups: readonly AdminMenuGroup[]) {
  for (const group of groups) {
    const value = findExpandedMenuItemValue(group.children)
    if (value) return value
  }
}

function findExpandedMenuItemValue(items: readonly AdminMenuItem[]) {
  for (const item of items) {
    if (!item.children?.length) continue
    if (item.active) return item.id

    const childValue = findExpandedMenuItemValue(item.children)
    if (childValue) return item.id
  }
}
</script>

<template>
  <UNavigationMenu
    v-model="openedMenuValue"
    :collapsed="isMenuCollapsed"
    :items="navigationItems"
    popover
    :highlight="false"
    type="single"
    orientation="vertical"
    :ui="{ list: 'space-y-1', childList: 'space-y-1 pt-1' }"
  >
    <template #item-leading="{ item }">
      <UIcon v-if="typeof item.menuIcon === 'string' && item.menuIcon.startsWith('i-')" class="font-bold text-dimmed" :class="{ 'text-primary': item.active }" :name="item.menuIcon" size="20" />
      <picture v-else-if="item.type !== 'label' && isMenuImageIcon(item.menuIcon)">
        <source media="(prefers-color-scheme: dark)" :srcset="getMenuImageIcon(item.menuIcon, 'dark')" />
        <img class="w-5 h-5 object-cover" :src="getMenuImageIcon(item.menuIcon)" />
      </picture>
    </template>
  </UNavigationMenu>
</template>
