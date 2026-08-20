<script setup lang="ts">
import type { AdminMenuImageIcon, LayoutBreadcrumbItem } from '@monorepo-admin-core/types'
import type { BreadcrumbItem } from '@nuxt/ui'
import { computed } from 'vue'

interface LayoutBreadcrumbNavigationItem extends BreadcrumbItem {
  menuIcon?: LayoutBreadcrumbItem['icon']
}

const props = defineProps<{
  breadcrumbPrefix?: LayoutBreadcrumbItem[]
  breadcrumbs?: LayoutBreadcrumbItem[]
}>()

const items = computed<LayoutBreadcrumbNavigationItem[]>(() =>
  [...(props.breadcrumbPrefix ?? []), ...(props.breadcrumbs ?? [])].map((item) => ({
    icon: typeof item.icon === 'string' ? item.icon : undefined,
    label: item.title,
    menuIcon: item.icon,
    to: item.path,
  })),
)

function getBreadcrumbImageIcon(icon: unknown, theme: 'light' | 'dark' = 'light'): string {
  const imageIcon = icon as AdminMenuImageIcon
  return theme === 'light' ? imageIcon.light : (imageIcon.dark ?? imageIcon.light)
}

function isBreadcrumbImageIcon(icon: unknown): icon is AdminMenuImageIcon {
  return typeof icon === 'object' && icon !== null && 'light' in icon
}
</script>

<template>
  <UBreadcrumb v-if="items.length" class="hidden sm:block" :items="items">
    <template #item-leading="{ active, item }">
      <UIcon v-if="typeof item.menuIcon === 'string' && item.menuIcon.startsWith('i-')" :class="{ 'text-default': active }" :name="item.menuIcon" size="18" />
      <picture v-else-if="isBreadcrumbImageIcon(item.menuIcon)" class="flex size-4.5 shrink-0 items-center justify-center">
        <source media="(prefers-color-scheme: dark)" :srcset="getBreadcrumbImageIcon(item.menuIcon, 'dark')" />
        <img class="size-4.5 object-contain" :src="getBreadcrumbImageIcon(item.menuIcon)" />
      </picture>
    </template>

    <template #item-label="{ active, item }">
      <span :class="{ 'text-default': active }">{{ item.label }}</span>
    </template>
  </UBreadcrumb>
</template>
