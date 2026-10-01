<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { computed, ref, watch } from 'vue'
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
        label: user.value.name,
        avatar: user.value.avatar,
        onSelect: markSelection,
        ui: {
          item: 'items-center ps-1',
          itemLabel: 'font-semibold',
        },
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
  </UDropdownMenu>
</template>
