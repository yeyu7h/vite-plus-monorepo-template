<script setup lang="ts">
import type { AdminMenuGroup, AdminMenuImageIcon, AdminMenuItem } from '@monorepo-admin-core/types'
import type { NavigationMenuItem } from '@nuxt/ui'
import { computed, nextTick, onMounted, ref, watch } from 'vue'

const props = defineProps<{
  collapsed: boolean
  groups: AdminMenuGroup[]
  opened: boolean
}>()

const navigationItems = computed<NavigationMenuItem[][]>(() => props.groups.map(toNavigationMenuGroup).filter((group) => group.length > 0))
const activeMenuValue = computed(() => findExpandedMenuValue(props.groups))
const openedMenuValue = ref<string | undefined>()

watch(activeMenuValue, (value) => {
  openedMenuValue.value = value
})

onMounted(async () => {
  const value = activeMenuValue.value
  if (!value) return

  openedMenuValue.value = undefined
  await nextTick()
  requestAnimationFrame(() => {
    openedMenuValue.value = value
  })
})

function toNavigationMenuGroup(group: AdminMenuGroup): NavigationMenuItem[] {
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

function toNavigationMenuItem(menu: AdminMenuItem): NavigationMenuItem {
  const hasChildren = Boolean(menu.children?.length)

  return {
    active: menu.active,
    children: menu.children?.map(toNavigationMenuItem),
    icon: menu.icon,
    label: menu.title,
    target: menu.externalLink ? '_blank' : undefined,
    to: menu.externalLink ?? menu.path,
    type: hasChildren ? 'trigger' : undefined,
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
    :collapsed="collapsed && !opened"
    :items="navigationItems"
    popover
    :highlight="false"
    type="single"
    orientation="vertical"
    :ui="{ list: 'space-y-1', childList: 'space-y-1 pt-1' }"
  >
    <template #item-leading="{ item }">
      <UIcon v-if="typeof item.icon !== 'object' && (item.icon as string)?.startsWith('i-')" class="font-bold text-dimmed" :class="{ 'text-primary': item.active }" :name="item.icon" size="20" />
      <picture v-else-if="item.type !== 'label' && isMenuImageIcon(item.icon)">
        <source media="(prefers-color-scheme: dark)" :srcset="getMenuImageIcon(item.icon, 'dark')" />
        <img class="w-5 h-5 object-cover" :src="getMenuImageIcon(item.icon)" />
      </picture>
    </template>
  </UNavigationMenu>
</template>
