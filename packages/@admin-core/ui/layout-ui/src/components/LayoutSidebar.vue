<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const SIDEBAR_OVERLAY_EXIT_DURATION = 100
type SidebarOverlayCloseReason = 'selection'

const props = withDefaults(
  defineProps<{
    storageKey?: string
  }>(),
  {
    storageKey: '@monorepo-admin-core/layout-ui:sidebar-collapsed',
  },
)

const emit = defineEmits<{
  'update:collapsed': [value: boolean]
}>()

function readPersistedCollapsed() {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(props.storageKey) === 'true'
  } catch {
    return false
  }
}

function persistCollapsed(value: boolean) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(props.storageKey, String(value))
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }
}

const collapsed = ref(readPersistedCollapsed())
const hovered = ref(false)
const overlayOpen = ref(false)
let sidebarElement: HTMLElement | undefined
let overlayCloseFrame: number | undefined
let overlayCloseTimer: ReturnType<typeof setTimeout> | undefined

const temporarilyExpanded = computed(() => collapsed.value && (hovered.value || overlayOpen.value))
const visuallyExpanded = computed(() => !collapsed.value || temporarilyExpanded.value)

watch(
  collapsed,
  (value) => {
    persistCollapsed(value)
    emit('update:collapsed', value)
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  cancelPendingOverlayClose()
  cancelOverlaySelectionHold()
})

function cancelPendingOverlayClose() {
  if (overlayCloseTimer !== undefined) {
    clearTimeout(overlayCloseTimer)
    overlayCloseTimer = undefined
  }
  if (overlayCloseFrame === undefined) return
  if (typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(overlayCloseFrame)
  overlayCloseFrame = undefined
}

function cancelOverlaySelectionHold() {
  if (typeof document !== 'undefined') document.removeEventListener('pointermove', releaseOverlaySelectionHold, true)
}

function releaseOverlaySelectionHold() {
  cancelOverlaySelectionHold()
  hovered.value = sidebarElement?.matches(':hover') ?? false
}

function holdOverlayAfterSelection() {
  hovered.value = true
  if (typeof document !== 'undefined') document.addEventListener('pointermove', releaseOverlaySelectionHold, { capture: true, once: true })
}

function expandTemporarily(event: MouseEvent) {
  sidebarElement = event.currentTarget as HTMLElement
  hovered.value = true
}

function collapseTemporarily() {
  hovered.value = false
}

function setOverlayOpen(value: boolean, closeReason?: SidebarOverlayCloseReason) {
  cancelPendingOverlayClose()

  if (value) {
    cancelOverlaySelectionHold()
    overlayOpen.value = true
    return
  }

  if (typeof requestAnimationFrame === 'undefined') {
    overlayOpen.value = false
    return
  }

  // Keep the overlay trigger stable until Nuxt UI finishes its exit animation.
  overlayCloseTimer = setTimeout(() => {
    overlayCloseTimer = undefined
    overlayCloseFrame = requestAnimationFrame(() => {
      overlayCloseFrame = undefined
      if (closeReason === 'selection') holdOverlayAfterSelection()
      else if (sidebarElement?.matches(':hover')) hovered.value = true
      overlayOpen.value = false
    })
  }, SIDEBAR_OVERLAY_EXIT_DURATION)
}

function toggleCollapsed() {
  collapsed.value = !collapsed.value
}
</script>

<template>
  <div data-sidebar-space aria-hidden="true" class="hidden h-svh shrink-0 transition-[width] duration-200 ease-out lg:block" :class="collapsed ? 'w-16' : 'w-60'" />

  <aside
    id="primary-navigation"
    :data-collapsed="collapsed"
    class="group/sidebar fixed start-0 top-0 z-20 hidden h-svh shrink-0 flex-col overflow-visible bg-transparent transition-[width] duration-200 ease-out after:pointer-events-none after:absolute after:inset-y-0 after:start-0 after:z-0 after:content-[''] after:border-e after:border-default after:bg-default after:transition-[width,box-shadow] after:duration-200 after:ease-out lg:flex"
    :class="[collapsed ? 'w-16' : 'w-60', visuallyExpanded ? 'after:w-60' : 'after:w-full', temporarilyExpanded ? 'after:shadow-xl' : 'after:shadow-none']"
    @mouseenter="expandTemporarily"
    @mouseleave="collapseTemporarily"
  >
    <div
      class="relative z-10 flex h-(--ui-header-height) shrink-0 items-center overflow-hidden bg-transparent px-4 transition-[width] duration-200 ease-out"
      :class="visuallyExpanded ? 'w-60' : 'w-16'"
    >
      <div data-sidebar-header class="relative flex h-8 w-52 shrink-0 items-center">
        <span data-sidebar-logo class="flex min-w-0 items-center whitespace-nowrap text-highlighted">
          <span class="flex size-8 shrink-0 items-center justify-center">
            <img data-sidebar-logo-icon src="https://raw.githubusercontent.com/Koolson/Qure/refs/heads/master/IconSet/Color/Apple.png" alt="" class="size-5 object-contain" aria-hidden="true" />
          </span>
          <span data-sidebar-logo-text class="text-sm font-semibold transition-opacity duration-200 ease-out" :class="visuallyExpanded ? 'opacity-100' : 'pointer-events-none opacity-0'"> Logo </span>
        </span>
        <UButton
          data-sidebar-collapse
          :aria-label="collapsed ? '固定侧边栏' : '取消固定侧边栏'"
          :aria-hidden="!visuallyExpanded"
          :icon="collapsed ? 'i-lucide-pin' : 'i-lucide-pin-off'"
          :tabindex="visuallyExpanded ? undefined : -1"
          :title="collapsed ? '固定侧边栏' : '取消固定侧边栏'"
          color="neutral"
          variant="ghost"
          :ui="{ leadingIcon: 'size-4' }"
          class="absolute inset-e-0 hidden shrink-0 transition-opacity duration-200 ease-out lg:inline-flex"
          :class="visuallyExpanded ? 'opacity-100' : 'pointer-events-none opacity-0'"
          @click="toggleCollapsed"
        />
      </div>
    </div>

    <div
      class="relative z-10 flex flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden bg-transparent px-4 py-2 transition-[width] duration-200 ease-out [scrollbar-color:var(--ui-border-accented)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-corner]:bg-transparent [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[var(--ui-border-accented)]"
      :class="visuallyExpanded ? 'w-60' : 'w-16'"
      data-slot="body"
    >
      <slot name="menu" :collapsed="collapsed" :opened="visuallyExpanded" :set-overlay-open="setOverlayOpen" />
    </div>

    <div
      v-if="$slots.footer"
      class="relative z-10 shrink-0 overflow-hidden border-t border-default bg-transparent px-3 py-2.5 transition-[width] duration-200 ease-out"
      :class="visuallyExpanded ? 'w-60' : 'w-16'"
      data-slot="footer"
    >
      <slot name="footer" :collapsed="collapsed" :opened="visuallyExpanded" :set-overlay-open="setOverlayOpen" />
    </div>
  </aside>
</template>
