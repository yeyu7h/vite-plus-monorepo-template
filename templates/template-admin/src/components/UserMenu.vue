<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { useColorMode } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { loadThemePreferences, primaryColors, radiusOptions, saveThemePreferences } from '@/features/theme-preferences'
import type { PrimaryColor, RadiusOption, ThemePreferences } from '@/features/theme-preferences'
import { useAdminAuthStore } from '@/stores/auth'
import { useAdminUserStore } from '@/stores/user'

const TEMP_USER_AVATAR_URL = 'https://avatars.githubusercontent.com/u/49150556?v=4&size=64'

const props = defineProps<{
  collapsed?: boolean
  open?: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean, reason?: 'selection']
}>()

const open = ref(props.open ?? false)
let closingFromSelection = false

const authStore = useAdminAuthStore()
const userStore = useAdminUserStore()
const colorMode = useColorMode()
const themePreferences = ref<ThemePreferences>(loadThemePreferences())

const appearanceOptions = [
  { label: '跟随系统', value: 'auto', icon: 'i-lucide-monitor' },
  { label: '浅色', value: 'light', icon: 'i-lucide-sun' },
  { label: '深色', value: 'dark', icon: 'i-lucide-moon' },
] as const

watch(
  () => props.open,
  (value) => {
    if (value !== undefined) open.value = value
  },
)

function markSelection() {
  closingFromSelection = true
}

function selectLogout() {
  markSelection()
  authStore.logout()
}

function selectAppearance(value: (typeof appearanceOptions)[number]['value']) {
  colorMode.store.value = value
}

function selectPrimary(primary: PrimaryColor) {
  themePreferences.value = { ...themePreferences.value, primary }
  saveThemePreferences(themePreferences.value)
}

function selectRadius(radius: RadiusOption) {
  themePreferences.value = { ...themePreferences.value, radius }
  saveThemePreferences(themePreferences.value)
}

function chipColor(item: DropdownMenuItem) {
  return 'chip' in item && typeof item.chip === 'string' ? item.chip : undefined
}

function setOpen(value: boolean) {
  open.value = value
  const reason = !value && closingFromSelection ? 'selection' : undefined
  if (!value) closingFromSelection = false
  emit('update:open', value, reason)
}

const user = computed(() => {
  const userInfo = userStore.userInfo
  if (!userInfo) return null

  const name = userInfo.real_name ?? userInfo.username

  return {
    name,
    avatar: {
      src: TEMP_USER_AVATAR_URL,
      alt: name,
    },
  }
})

const items = computed<DropdownMenuItem[][]>(() => {
  if (!user.value) return []

  return [
    [
      {
        type: 'label',
        label: user.value.name,
        avatar: user.value.avatar,
        ui: {
          item: 'items-center ps-1',
          itemLabel: 'font-semibold',
        },
      },
    ],
    [
      {
        label: '主题色',
        icon: 'i-lucide-palette',
        content: { align: 'center', collisionPadding: 16 },
        children: primaryColors.map((color) => ({
          label: color.label,
          slot: 'chip',
          chip: color.preview,
          type: 'checkbox',
          checked: themePreferences.value.primary === color.value,
          onSelect: (event: Event) => {
            event.preventDefault()
            selectPrimary(color.value)
          },
        })),
      },
      {
        label: '外观',
        icon: 'i-lucide-sun-moon',
        children: appearanceOptions.map((option) => ({
          label: option.label,
          icon: option.icon,
          type: 'checkbox',
          checked: colorMode.store.value === option.value,
          onSelect: (event: Event) => {
            event.preventDefault()
            selectAppearance(option.value)
          },
        })),
      },
      {
        label: '圆角',
        icon: 'i-lucide-square-round-corner',
        content: { align: 'center', collisionPadding: 16 },
        children: radiusOptions.map((option) => ({
          label: option.label,
          type: 'checkbox',
          checked: themePreferences.value.radius === option.value,
          onSelect: (event: Event) => {
            event.preventDefault()
            selectRadius(option.value)
          },
        })),
      },
    ],
    [
      {
        label: '退出登录',
        icon: 'i-lucide-log-out',
        onSelect: selectLogout,
      },
    ],
  ]
})
</script>

<template>
  <UDropdownMenu
    v-if="user"
    :open="open"
    :items="items"
    :content="{ align: 'center', collisionPadding: 12 }"
    :ui="{ content: collapsed ? 'w-48' : 'w-(--reka-dropdown-menu-trigger-width)', itemLeadingAvatarSize: 'xs' }"
    @update:open="setOpen"
  >
    <UButton
      :avatar="user.avatar"
      :label="collapsed ? undefined : user.name"
      :trailing-icon="collapsed ? undefined : 'i-lucide-chevrons-up-down'"
      color="neutral"
      variant="ghost"
      block
      :square="collapsed"
      class="data-[state=open]:bg-elevated"
      :ui="{ base: 'justify-start px-2', label: 'font-semibold', leadingAvatarSize: 'xs', trailingIcon: 'text-dimmed' }"
    />
    <template #chip-leading="{ item }">
      <span class="inline-flex size-5 shrink-0 items-center justify-center">
        <span class="size-2 rounded-full ring ring-bg" :style="{ backgroundColor: chipColor(item) }" />
      </span>
    </template>
  </UDropdownMenu>
</template>
