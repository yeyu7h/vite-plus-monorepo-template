<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const SIDEBAR_OVERLAY_EXIT_DURATION = 100
const LARGE_SCREEN_MEDIA_QUERY = '(min-width: 64rem)'
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

const mobileOpen = defineModel<boolean>('open', { default: false })

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
    // Storage can be unavailable in private or restricted browser contexts / 隐私模式或受限的浏览器环境可能无法使用存储
  }
}

const collapsedPreference = ref(readPersistedCollapsed())
const largeScreenQuery = typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(LARGE_SCREEN_MEDIA_QUERY) : undefined
const isBelowLarge = ref(largeScreenQuery ? !largeScreenQuery.matches : false)
const compactCollapsedOverride = ref<boolean | undefined>()
const collapsed = computed(() => (isBelowLarge.value ? (compactCollapsedOverride.value ?? true) : collapsedPreference.value))
const hovered = ref(false)
const overlayOpen = ref(false)
let sidebarElement: HTMLElement | undefined
let overlayCloseFrame: number | undefined
let overlayCloseTimer: ReturnType<typeof setTimeout> | undefined

const temporarilyExpanded = computed(() => collapsed.value && (hovered.value || overlayOpen.value))
const visuallyExpanded = computed(() => !collapsed.value || temporarilyExpanded.value)

watch(collapsedPreference, (value) => persistCollapsed(value), { immediate: true })

watch(collapsed, (value) => emit('update:collapsed', value), { immediate: true })

function updateLargeScreenState(matches: boolean) {
  const nextIsBelowLarge = !matches
  if (nextIsBelowLarge === isBelowLarge.value) return
  isBelowLarge.value = nextIsBelowLarge
  if (nextIsBelowLarge) compactCollapsedOverride.value = undefined
}

function handleLargeScreenChange(event: MediaQueryListEvent) {
  updateLargeScreenState(event.matches)
}

onMounted(() => {
  if (!largeScreenQuery) return
  updateLargeScreenState(largeScreenQuery.matches)
  if (typeof largeScreenQuery.addEventListener === 'function') largeScreenQuery.addEventListener('change', handleLargeScreenChange)
  else largeScreenQuery.addListener(handleLargeScreenChange)
})

onBeforeUnmount(() => {
  cancelPendingOverlayClose()
  cancelOverlaySelectionHold()
  if (!largeScreenQuery) return
  if (typeof largeScreenQuery.removeEventListener === 'function') largeScreenQuery.removeEventListener('change', handleLargeScreenChange)
  else largeScreenQuery.removeListener(handleLargeScreenChange)
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

  // Keep the overlay trigger stable until Nuxt UI finishes its exit animation / 保持浮层触发器稳定，直到 Nuxt UI 退出动画结束
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
  const nextCollapsed = !collapsed.value
  if (isBelowLarge.value) {
    compactCollapsedOverride.value = nextCollapsed
    collapsedPreference.value = nextCollapsed
    return
  }
  collapsedPreference.value = nextCollapsed
}

function toggleMobileOpen() {
  mobileOpen.value = !mobileOpen.value
}

function closeMobileSidebar() {
  mobileOpen.value = false
}

function closeMobileSidebarAfterNavigation(event: MouseEvent) {
  const target = event.target
  if (target instanceof Element && target.closest('a')) closeMobileSidebar()
}

defineExpose({ close: closeMobileSidebar, toggle: toggleMobileOpen })
</script>

<template>
  <div data-sidebar-space aria-hidden="true" class="hidden h-svh shrink-0 transition-[width] duration-200 ease-out md:block" :class="collapsed ? 'w-16' : 'w-60'" />

  <aside
    id="primary-navigation"
    :data-collapsed="collapsed"
    class="group/sidebar fixed inset-s-0 top-0 z-20 hidden h-svh shrink-0 flex-col overflow-visible bg-transparent [--layout-sidebar-bg:#FCFCFC] transition-[width] duration-200 ease-out after:pointer-events-none after:absolute after:inset-y-0 after:inset-s-0 after:z-0 after:content-[''] after:border-e after:border-default after:bg-(--layout-sidebar-bg) after:transition-[width,box-shadow] after:duration-200 after:ease-out dark:[--layout-sidebar-bg:#1A1A1A] md:flex"
    :class="[collapsed ? 'w-16' : 'w-60', visuallyExpanded ? 'after:w-60' : 'after:w-full', temporarilyExpanded ? 'after:shadow-xl' : 'after:shadow-none']"
    @mouseenter="expandTemporarily"
    @mouseleave="collapseTemporarily"
  >
    <div
      class="relative z-10 flex h-(--ui-header-height) shrink-0 items-center overflow-hidden bg-transparent px-4 transition-[width] duration-200 ease-out"
      :class="visuallyExpanded ? 'w-60' : 'w-16'"
      data-slot="header"
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
          :aria-label="collapsed ? '展开边栏' : '折叠边栏'"
          :aria-hidden="!visuallyExpanded"
          :icon="collapsed ? 'i-lucide-panel-left-open' : 'i-lucide-panel-left-close'"
          :tabindex="visuallyExpanded ? undefined : -1"
          :title="collapsed ? '固定侧边栏' : '取消固定侧边栏'"
          color="neutral"
          variant="ghost"
          :ui="{ leadingIcon: 'size-5' }"
          class="absolute inset-e-0 hidden shrink-0 transition-opacity duration-200 ease-out md:inline-flex"
          :class="visuallyExpanded ? 'opacity-100' : 'pointer-events-none opacity-0'"
          @click="toggleCollapsed"
        />
      </div>
    </div>

    <div
      class="relative z-10 flex flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden bg-transparent px-4 py-2 transition-[width] duration-200 ease-out [mask-image:linear-gradient(to_bottom,transparent_0,black_0.75rem,black_calc(100%_-_0.75rem),transparent_100%)] [scrollbar-color:var(--ui-border-accented)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-corner]:bg-transparent [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[var(--ui-border-accented)]"
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

  <UDrawer v-model:open="mobileOpen" title="主导航" description="应用导航" direction="left" :handle="false" :ui="{ content: 'w-60 max-w-[calc(100%-2rem)] md:hidden', overlay: 'md:hidden' }">
    <template #content>
      <div data-mobile-sidebar class="flex h-svh w-full flex-col bg-default">
        <div class="relative flex h-(--ui-header-height) shrink-0 items-center overflow-hidden px-4" data-mobile-slot="header">
          <div class="relative flex h-8 w-full shrink-0 items-center">
            <span data-mobile-sidebar-logo class="flex min-w-0 items-center whitespace-nowrap text-highlighted">
              <span class="flex size-8 shrink-0 items-center justify-center">
                <img
                  data-mobile-sidebar-logo-icon
                  src="https://raw.githubusercontent.com/Koolson/Qure/refs/heads/master/IconSet/Color/Apple.png"
                  alt=""
                  class="size-5 object-contain"
                  aria-hidden="true"
                />
              </span>
              <span class="text-sm font-semibold"> Logo </span>
            </span>
            <UButton
              data-mobile-sidebar-close
              icon="i-lucide-x"
              aria-label="关闭边栏"
              title="关闭边栏"
              color="neutral"
              variant="ghost"
              :ui="{ leadingIcon: 'size-5' }"
              class="ms-auto shrink-0"
              @click="closeMobileSidebar"
            />
          </div>
        </div>

        <div
          class="relative flex flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden px-4 py-2 [mask-image:linear-gradient(to_bottom,transparent_0,black_0.75rem,black_calc(100%_-_0.75rem),transparent_100%)] [scrollbar-color:var(--ui-border-accented)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-corner]:bg-transparent [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[var(--ui-border-accented)]"
          data-mobile-slot="body"
          @click="closeMobileSidebarAfterNavigation"
        >
          <slot name="menu" :collapsed="false" :opened="true" :set-overlay-open="setOverlayOpen" />
        </div>

        <div v-if="$slots.footer" class="shrink-0 border-t border-default px-3 py-2.5" data-mobile-slot="footer">
          <slot name="footer" :collapsed="false" :opened="true" :set-overlay-open="setOverlayOpen" />
        </div>
      </div>
    </template>
  </UDrawer>
</template>
