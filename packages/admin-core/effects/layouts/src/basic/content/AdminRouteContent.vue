<script setup lang="ts">
import type { AdminTabRecord } from '@monorepo-admin-core/types'
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import { storeToRefs } from 'pinia'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { IFrameRouterView } from '../../iframe'
import { useAdminTabStore } from '../../stores'

defineOptions({ name: 'AdminRouteContent' })

const router = useRouter()
const route = useRoute()
const tabStore = useAdminTabStore()
const { activeKey, activeRecord, iframeTabs, keepAlivePageTabs } = storeToRefs(tabStore)
const contentMarker = ref<HTMLElement>()
const scrollElementKeys = new WeakMap<HTMLElement, string>()
const handledScrollEvents = new WeakSet<Event>()
const scrollElements = new Map<string, HTMLElement>()
const bufferedScrollPositions = new Map<string, Map<string, ScrollPosition>>()
const pendingScrollPositions = new Map<string, Map<string, ScrollPosition>>()
let contentRoot: HTMLElement | undefined
let concealedContentRoot: { element: HTMLElement; visibility: string } | undefined
let pendingScrollFrame: number | undefined
let scrollElementSequence = 0
let restoreGeneration = 0
let restoringTabKey = ''

interface ScrollPosition {
  left: number
  top: number
}

const resolvedKeepAliveTabs = computed(() => keepAlivePageTabs.value.map(resolveTab))
const activeResolvedRoute = computed(() => {
  const record = activeRecord.value
  return record ? router.resolve(record.viewPath) : route
})
const activeIframeSrc = computed(() => {
  const source = activeRecord.value?.iframeSrc ?? route.meta.iframeSrc
  return typeof source === 'string' ? source.trim() : ''
})
const activeTitle = computed(() => activeRecord.value?.title ?? route.meta.title ?? '内嵌页面')
const isActiveKeepAlivePage = computed(() => Boolean(activeRecord.value?.keepAlive && !activeRecord.value.iframeSrc))
const renderedIframeTabs = computed(() => {
  const persistentTabs = iframeTabs.value.filter((item) => item.keepAlive && tabStore.hasRendered(item.key))
  const activeIframe = activeRecord.value?.iframeSrc && !activeRecord.value.keepAlive ? activeRecord.value : void 0

  return activeIframe ? [...persistentTabs, activeIframe] : persistentTabs
})

function resolveTab(record: AdminTabRecord) {
  return {
    record,
    route: router.resolve(record.viewPath),
  }
}

function isActive(record: AdminTabRecord) {
  return record.key === activeKey.value
}

function renderKey(record: AdminTabRecord) {
  return tabStore.getRenderKey(record.key)
}

function getScrollElementKey(element: HTMLElement) {
  const currentKey = scrollElementKeys.get(element)
  if (currentKey) return currentKey

  const key = `scroll-element-${++scrollElementSequence}`
  scrollElementKeys.set(element, key)
  scrollElements.set(key, element)
  return key
}

function bufferScrollPosition(tabKey: string, elementKey: string, position: ScrollPosition) {
  const positions = bufferedScrollPositions.get(tabKey) ?? new Map<string, ScrollPosition>()
  positions.set(elementKey, position)
  bufferedScrollPositions.set(tabKey, positions)
}

function handleScroll(event: Event) {
  if (handledScrollEvents.has(event)) return
  handledScrollEvents.add(event)

  const element = resolveScrollElement(event)
  const record = activeRecord.value

  if (!element || !record?.keepAlive || record.iframeSrc || restoringTabKey === record.key || !isTrackedScrollElement(element)) return

  const elementKey = getScrollElementKey(element)
  const positions = pendingScrollPositions.get(record.key) ?? new Map<string, ScrollPosition>()
  positions.set(elementKey, {
    left: element.scrollLeft,
    top: element.scrollTop,
  })
  pendingScrollPositions.set(record.key, positions)
  schedulePendingScrollFlush()
}

function schedulePendingScrollFlush() {
  if (pendingScrollFrame !== void 0) return

  pendingScrollFrame = requestAnimationFrame(() => {
    pendingScrollFrame = void 0
    flushPendingScrollPositions()
  })
}

function flushPendingScrollPositions() {
  if (pendingScrollFrame !== void 0) {
    cancelAnimationFrame(pendingScrollFrame)
    pendingScrollFrame = void 0
  }

  for (const [tabKey, positions] of pendingScrollPositions) {
    for (const [elementKey, position] of positions) {
      bufferScrollPosition(tabKey, elementKey, position)
    }
  }

  pendingScrollPositions.clear()
}

function commitTabScrollPositions(tabKey: string) {
  flushPendingScrollPositions()

  const record = tabStore.records.find((item) => item.key === tabKey)
  if (!record?.keepAlive || record.iframeSrc) return

  tabStore.setScrollPositions(tabKey, Object.fromEntries(bufferedScrollPositions.get(tabKey) ?? []))
}

function restoreTabScrollPositions(tabKey: string) {
  if (activeKey.value !== tabKey) return

  const generation = ++restoreGeneration
  const positions = { ...tabStore.getScrollPositions(tabKey) }
  const stabilizeBeforePaint = Object.keys(positions).length > 0

  if (stabilizeBeforePaint) concealContent()
  applyTabScrollPositions(tabKey, positions)

  if (!stabilizeBeforePaint) {
    revealContent()
    return
  }

  requestAnimationFrame(() => {
    if (generation !== restoreGeneration || activeKey.value !== tabKey) return

    try {
      applyTabScrollPositions(tabKey, positions)
    } finally {
      revealContent()
    }
  })
}

function applyTabScrollPositions(tabKey: string, positions: Readonly<Record<string, ScrollPosition>>) {
  restoringTabKey = tabKey
  try {
    for (const [elementKey, element] of scrollElements) {
      if (!isTrackedScrollElement(element)) continue

      const position = positions[elementKey] ?? { left: 0, top: 0 }
      const scrollBehavior = element.style.scrollBehavior
      element.style.scrollBehavior = 'auto'
      element.scrollLeft = position.left
      element.scrollTop = position.top
      element.style.scrollBehavior = scrollBehavior
      bufferScrollPosition(tabKey, elementKey, position)
    }
  } finally {
    restoringTabKey = ''
  }
}

function concealContent() {
  if (!contentRoot || concealedContentRoot) return

  concealedContentRoot = {
    element: contentRoot,
    visibility: contentRoot.style.visibility,
  }
  contentRoot.style.visibility = 'hidden'
}

function revealContent() {
  if (!concealedContentRoot) return

  concealedContentRoot.element.style.visibility = concealedContentRoot.visibility
  concealedContentRoot = void 0
}

function clearBufferedTab(tabKey: string) {
  bufferedScrollPositions.delete(tabKey)
  pendingScrollPositions.delete(tabKey)
}

function pruneDisconnectedScrollElements() {
  const retainedElementKeys = new Set<string>()

  for (const positions of Object.values(tabStore.scrollPositions)) {
    for (const elementKey of Object.keys(positions)) retainedElementKeys.add(elementKey)
  }

  for (const positions of bufferedScrollPositions.values()) {
    for (const elementKey of positions.keys()) retainedElementKeys.add(elementKey)
  }

  for (const positions of pendingScrollPositions.values()) {
    for (const elementKey of positions.keys()) retainedElementKeys.add(elementKey)
  }

  for (const [elementKey, element] of scrollElements) {
    if (!element.isConnected && !retainedElementKeys.has(elementKey)) {
      scrollElements.delete(elementKey)
    }
  }
}

async function pruneAfterRender() {
  await nextTick()
  await nextAnimationFrame()
  pruneDisconnectedScrollElements()
}

function resolveScrollElement(event: Event) {
  if (event.target instanceof HTMLElement) return event.target

  if (event.target === document || event.target === window) {
    const scrollingElement = document.scrollingElement
    return scrollingElement instanceof HTMLElement ? scrollingElement : document.documentElement
  }

  return void 0
}

function isTrackedScrollElement(element: HTMLElement) {
  return element === document.scrollingElement || element === document.documentElement || element === document.body || contentRoot === element || Boolean(contentRoot?.contains(element))
}

function nextAnimationFrame() {
  return new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => resolve())
      return
    }

    setTimeout(resolve)
  })
}

watch(
  activeKey,
  (_key, previousKey) => {
    if (previousKey) commitTabScrollPositions(previousKey)
  },
  { flush: 'pre' },
)

watch(
  activeKey,
  (key) => {
    if (key) restoreTabScrollPositions(key)
  },
  { flush: 'post' },
)

watch(
  () => tabStore.records.map((item) => item.key),
  (keys) => {
    const retainedKeys = new Set(keys)

    for (const key of bufferedScrollPositions.keys()) {
      if (!retainedKeys.has(key)) clearBufferedTab(key)
    }

    void pruneAfterRender()
  },
  { flush: 'post' },
)

watch(
  () => [activeKey.value, activeKey.value ? (tabStore.refreshVersions[activeKey.value] ?? 0) : 0] as const,
  ([key, version], previous) => {
    if (!key || !previous || previous[0] !== key || previous[1] === version) return

    clearBufferedTab(key)
    restoreTabScrollPositions(key)
    void pruneAfterRender()
  },
  { flush: 'post' },
)

onMounted(() => {
  contentRoot = contentMarker.value?.parentElement ?? void 0
  document.addEventListener('scroll', handleScroll, true)
  contentRoot?.addEventListener('scroll', handleScroll, true)
})

onBeforeUnmount(() => {
  restoreGeneration += 1
  restoringTabKey = ''
  revealContent()
  if (pendingScrollFrame !== void 0) cancelAnimationFrame(pendingScrollFrame)
  document.removeEventListener('scroll', handleScroll, true)
  contentRoot?.removeEventListener('scroll', handleScroll, true)
  contentRoot = void 0
  pendingScrollFrame = void 0
  pendingScrollPositions.clear()
  bufferedScrollPositions.clear()
  scrollElements.clear()
})

function asNormalizedRoute(route: unknown) {
  return route as RouteLocationNormalizedLoaded
}
</script>

<template>
  <span ref="contentMarker" aria-hidden="true" class="hidden" />

  <template v-for="item in resolvedKeepAliveTabs" :key="item.record.key">
    <RouterView :route="asNormalizedRoute(item.route)" v-slot="{ Component }">
      <KeepAlive :key="renderKey(item.record)">
        <component :is="Component" v-if="isActive(item.record)" :key="item.record.key" />
      </KeepAlive>
    </RouterView>
  </template>

  <RouterView v-if="!activeIframeSrc && !isActiveKeepAlivePage" :route="asNormalizedRoute(activeResolvedRoute)" v-slot="{ Component }">
    <component :is="Component" :key="tabStore.getRenderKey(activeKey)" />
  </RouterView>

  <IFrameRouterView v-for="item in renderedIframeTabs" v-show="isActive(item)" :key="renderKey(item)" :src="item.iframeSrc!" :title="item.title" />

  <IFrameRouterView v-if="activeIframeSrc && !activeRecord" :key="route.fullPath" :src="activeIframeSrc" :title="String(activeTitle)" />
</template>
