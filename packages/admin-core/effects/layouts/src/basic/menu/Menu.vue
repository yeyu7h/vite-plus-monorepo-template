<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'
import { ref } from 'vue'

defineProps<{
  collapsed: boolean
  opened: boolean
}>()

function getMenuImageIcon(menu: NavigationMenuItem, theme: 'light' | 'dark' = 'light'): string {
  const icon = menu.icon

  if (!icon) return ''
  if (typeof icon === 'string') return icon

  if (theme === 'light') return icon.light
  else return icon.dark
}

const items = ref<NavigationMenuItem[][]>([
  [
    {
      label: 'Icons',
      icon: 'i-lucide-smile',
      description: 'You have nothing to do, @nuxt/icon will handle it automatically.',
    },
    {
      label: 'Icons',
      icon: 'i-lucide-smile',
      description: 'You have nothing to do, @nuxt/icon will handle it automatically.',
    },
    {
      label: 'Icons',
      icon: 'i-lucide-smile',
      description: 'You have nothing to do, @nuxt/icon will handle it automatically.',
    },
    {
      label: 'Links',
      type: 'label',
    },
    {
      label: 'Guide',
      icon: 'i-lucide-book-open',
      children: [
        {
          label: 'Introduction',
          description: 'Fully styled and customizable components for Nuxt.',
          icon: 'i-lucide-house',
        },
        {
          label: 'Installation',
          description: 'Learn how to install and configure Nuxt UI in your application.',
          icon: 'i-lucide-cloud-download',
        },
        {
          label: 'Icons',
          icon: 'i-lucide-smile',
          description: 'You have nothing to do, @nuxt/icon will handle it automatically.',
        },
        {
          label: 'Colors',
          icon: 'i-lucide-swatch-book',
          description: 'Choose a primary and a neutral color from your Tailwind CSS theme.',
        },
        {
          label: 'Theme',
          icon: 'i-lucide-cog',
          description: 'You can customize components by using the `class` / `ui` props or in your app.config.ts.',
        },
      ],
    },
    {
      label: 'Composables',
      icon: 'i-lucide-database',
      children: [
        {
          label: 'defineShortcuts',
          icon: 'i-lucide-file-text',
          description: 'Define shortcuts for your application.',
          to: '/docs/composables/define-shortcuts',
        },
        {
          label: 'useOverlay',
          icon: 'i-lucide-file-text',
          description: 'Display a modal/slideover within your application.',
          to: '/docs/composables/use-overlay',
        },
        {
          label: 'useToast',
          icon: 'i-lucide-file-text',
          description: 'Display a toast within your application.',
          to: '/docs/composables/use-toast',
        },
      ],
    },
    {
      label: 'Components',
      icon: 'i-lucide-box',
      to: '/docs/components',
      type: 'trigger',
      children: [
        {
          label: 'Link',
          icon: 'i-lucide-file-text',
          description: 'Use NuxtLink with superpowers.',
          to: '/docs/components/link',
          active: true,
        },
        {
          label: 'Modal',
          icon: 'i-lucide-file-text',
          description: 'Display a modal within your application.',
          to: '/docs/components/modal',
        },
        {
          label: 'NavigationMenu',
          icon: 'i-lucide-file-text',
          description: 'Display a list of links.',
          to: '/docs/components/navigation-menu',
        },
        {
          label: 'Pagination',
          icon: 'i-lucide-file-text',
          description: 'Display a list of pages.',
          to: '/docs/components/pagination',
        },
        {
          label: 'Popover',
          icon: 'i-lucide-file-text',
          description: 'Display a non-modal dialog that floats around a trigger element.',
          to: '/docs/components/popover',
        },
        {
          label: 'Progress',
          icon: 'i-lucide-file-text',
          description: 'Show a horizontal bar to indicate task progression.',
          to: '/docs/components/progress',
        },
      ],
    },
  ],
  [
    {
      label: 'GitHub',
      icon: {
        light: 'https://raw.githubusercontent.com/yeyuqh/QuantumultX-IconSet/refs/heads/main/IconSet/proicons--openai.png',
        dark: 'https://raw.githubusercontent.com/yeyuqh/QuantumultX-IconSet/refs/heads/main/IconSet/la--adobe.png',
      },
      badge: '6k',
      to: 'https://github.com/nuxt/ui',
      target: '_blank',
    },
    {
      label: 'Help',
      icon: 'i-lucide-circle-help',
      disabled: true,
    },
  ],
])
</script>

<template>
  <UNavigationMenu :collapsed="collapsed && !opened" :items="items" popover :highlight="false" type="single" orientation="vertical" :ui="{ list: 'space-y-1', childList: 'space-y-1 pt-1' }">
    <template #item-leading="{ item }">
      <UIcon v-if="typeof item.icon !== 'object' && (item.icon as string)?.startsWith('i-')" class="font-bold text-dimmed" :class="{ 'text-primary': item.active }" :name="item.icon" size="20" />
      <picture v-else-if="item.type !== 'label'">
        <source media="(prefers-color-scheme: dark)" :srcset="getMenuImageIcon(item, 'dark')" />
        <img class="w-5 h-5 object-cover" :src="getMenuImageIcon(item)" />
      </picture>
    </template>
  </UNavigationMenu>
</template>
