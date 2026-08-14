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
const opened = ref(false)
const hovered = ref(false)
const overlayOpen = ref(false)
let sidebarElement: HTMLElement | undefined
let overlayCloseFrame: number | undefined
let overlayCloseTimer: ReturnType<typeof setTimeout> | undefined

const temporarilyExpanded = computed(() => collapsed.value && (hovered.value || overlayOpen.value))
const visuallyExpanded = computed(() => !collapsed.value || temporarilyExpanded.value)
const sidebarUi = computed(() => ({
  root: [
    'group/sidebar isolate z-20 overflow-visible border-e-0 bg-transparent transition-[width] duration-200 ease-out',
    "after:pointer-events-none after:absolute after:inset-y-0 after:start-0 after:z-0 after:content-[''] after:border-e after:border-default after:bg-default after:transition-[width,box-shadow] after:duration-200 after:ease-out",
    visuallyExpanded.value ? 'after:w-60' : 'after:w-full',
    temporarilyExpanded.value ? 'after:shadow-xl' : 'after:shadow-none',
  ],
  header: ['relative z-10 overflow-hidden bg-transparent px-4 transition-[width] duration-200 ease-out', visuallyExpanded.value ? 'w-60' : 'w-16'],
  body: [
    'relative z-10 overflow-x-hidden bg-transparent px-4 transition-[width] duration-200 ease-out',
    '[scrollbar-color:var(--ui-border-accented)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-corner]:bg-transparent [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[var(--ui-border-accented)]',
    visuallyExpanded.value ? 'w-60' : 'w-16',
  ],
  footer: ['relative z-10 overflow-hidden border-t border-default bg-transparent px-3 py-2.5 transition-[width] duration-200 ease-out', visuallyExpanded.value ? 'w-60' : 'w-16'],
  content: 'z-30',
  overlay: 'z-30',
}))

watch(collapsed, persistCollapsed)

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
  <UDashboardSidebar
    v-model:collapsed="collapsed"
    v-model:open="opened"
    id="primary-navigation"
    collapsible
    :resizable="false"
    :collapsed-size="64"
    :default-size="240"
    :max-size="240"
    :min-size="240"
    :ui="sidebarUi"
    @mouseenter="expandTemporarily"
    @mouseleave="collapseTemporarily"
  >
    <template #header>
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
    </template>

    <slot name="menu" :collapsed="collapsed" :opened="opened || visuallyExpanded" :set-overlay-open="setOverlayOpen" />

    <template #footer>
      <slot name="footer" :collapsed="collapsed" :opened="opened || visuallyExpanded" :set-overlay-open="setOverlayOpen" />
    </template>
  </UDashboardSidebar>
</template>
