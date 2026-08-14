import type { AdminTabRecord, PersistedAdminTab } from '@monorepo-admin-core/types'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { closeAdminTab, markActiveAdminTabs, upsertAdminTab } from '../navigation/route-tab'

const PERSISTENCE_VERSION = 1

export const DEFAULT_ADMIN_TAB_STORAGE_KEY = '@monorepo-admin-core/layout-effect:open-tabs'

interface PersistedAdminTabState {
  tabs: PersistedAdminTab[]
  version: typeof PERSISTENCE_VERSION
}

export interface ResetAdminTabsOptions {
  clearPersisted?: boolean
  storageKey?: string
}

export interface AdminTabScrollPosition {
  left: number
  top: number
}

export const useAdminTabStore = defineStore('admin-layout-tabs', () => {
  const activeKey = ref('')
  const initialized = ref(false)
  const records = ref<AdminTabRecord[]>([])
  const refreshVersions = ref<Record<string, number>>({})
  const renderedKeys = ref(new Set<string>())
  const scrollPositions = shallowRef<Record<string, Record<string, AdminTabScrollPosition>>>({})
  const storageKey = ref(DEFAULT_ADMIN_TAB_STORAGE_KEY)

  const activeRecord = computed(() => records.value.find((item) => item.key === activeKey.value))
  const iframeTabs = computed(() => records.value.filter((item) => Boolean(item.iframeSrc)))
  const keepAlivePageTabs = computed(() => records.value.filter((item) => item.keepAlive && !item.iframeSrc))
  const tabs = computed(() => markActiveAdminTabs(records.value, activeKey.value))

  function initialize(key: string, restoredRecords: readonly AdminTabRecord[]) {
    if (initialized.value && storageKey.value === key) return

    storageKey.value = key
    records.value = dedupeRecords(restoredRecords)
    refreshVersions.value = {}
    renderedKeys.value.clear()
    scrollPositions.value = {}
    initialized.value = true
    persist()
  }

  function readPersistedTabs(key: string): PersistedAdminTab[] {
    if (typeof sessionStorage === 'undefined') return []

    try {
      const rawState = sessionStorage.getItem(key)
      if (!rawState) return []

      const state = JSON.parse(rawState) as unknown
      if (!isPersistedState(state)) {
        removePersistedState(key)
        return []
      }

      return state.tabs
    } catch {
      removePersistedState(key)
      return []
    }
  }

  function setActive(key: string) {
    activeKey.value = key
    renderedKeys.value.add(key)
  }

  function upsert(record: AdminTabRecord) {
    records.value = upsertAdminTab(records.value, record) as AdminTabRecord[]
    persist()
  }

  function close(key: string) {
    const wasActive = key === activeKey.value
    const index = records.value.findIndex((item) => item.key === key)
    const nextRecord = index === -1 ? void 0 : (records.value[index + 1] ?? records.value[index - 1])
    const result = closeAdminTab(records.value, key, activeKey.value)
    const didClose = result.tabs.length < records.value.length

    if (!didClose) return void 0

    records.value = result.tabs
    renderedKeys.value.delete(key)
    delete refreshVersions.value[key]
    clearScrollPositions(key)

    if (wasActive && nextRecord) {
      activeKey.value = nextRecord.key
    }

    persist()
    return wasActive ? nextRecord?.viewPath : void 0
  }

  function refresh(key: string) {
    if (!records.value.some((item) => item.key === key)) return

    refreshVersions.value[key] = (refreshVersions.value[key] ?? 0) + 1
    clearScrollPositions(key)
  }

  function getRenderKey(key: string) {
    return `${key}:${refreshVersions.value[key] ?? 0}`
  }

  function hasRendered(key: string) {
    return renderedKeys.value.has(key)
  }

  function setScrollPositions(key: string, positions: Readonly<Record<string, AdminTabScrollPosition>>) {
    if (!records.value.some((item) => item.key === key && item.keepAlive)) return

    scrollPositions.value = {
      ...scrollPositions.value,
      [key]: { ...positions },
    }
  }

  function getScrollPositions(key: string) {
    return scrollPositions.value[key] ?? {}
  }

  function clearScrollPositions(key: string) {
    if (!(key in scrollPositions.value)) return

    const nextPositions = { ...scrollPositions.value }
    delete nextPositions[key]
    scrollPositions.value = nextPositions
  }

  function reset(options: ResetAdminTabsOptions = {}) {
    const clearPersisted = options.clearPersisted ?? true
    const storageKeys = new Set([storageKey.value, options.storageKey].filter((key): key is string => Boolean(key)))

    activeKey.value = ''
    initialized.value = false
    records.value = []
    refreshVersions.value = {}
    renderedKeys.value.clear()
    scrollPositions.value = {}

    if (clearPersisted && typeof sessionStorage !== 'undefined') {
      for (const key of storageKeys) {
        removePersistedState(key)
      }
    }
  }

  function persist() {
    if (!initialized.value || typeof sessionStorage === 'undefined') return

    const state: PersistedAdminTabState = {
      tabs: records.value.map(({ to, viewPath }) => ({ to, viewPath })),
      version: PERSISTENCE_VERSION,
    }

    try {
      sessionStorage.setItem(storageKey.value, JSON.stringify(state))
    } catch {
      // 浏览器禁用存储或配额耗尽时，Tab 仍保持当前内存行为
    }
  }

  return {
    activeKey,
    activeRecord,
    close,
    getRenderKey,
    getScrollPositions,
    hasRendered,
    iframeTabs,
    initialize,
    initialized,
    keepAlivePageTabs,
    readPersistedTabs,
    records,
    refresh,
    refreshVersions,
    renderedKeys,
    reset,
    scrollPositions,
    setScrollPositions,
    setActive,
    storageKey,
    tabs,
    upsert,
  }
})

function dedupeRecords(records: readonly AdminTabRecord[]) {
  return records.reduce<AdminTabRecord[]>((result, record) => upsertAdminTab(result, record) as AdminTabRecord[], [])
}

function isPersistedState(value: unknown): value is PersistedAdminTabState {
  if (!isRecord(value) || value.version !== PERSISTENCE_VERSION || !Array.isArray(value.tabs)) return false

  return value.tabs.every((item) => isRecord(item) && typeof item.to === 'string' && Boolean(item.to) && typeof item.viewPath === 'string' && Boolean(item.viewPath))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function removePersistedState(key: string) {
  try {
    sessionStorage.removeItem(key)
  } catch {
    // 浏览器禁用存储时只清理内存状态
  }
}
