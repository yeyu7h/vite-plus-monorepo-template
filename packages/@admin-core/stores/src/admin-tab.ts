import type { AdminTabPlacement, AdminTabRecord, PersistedAdminTab } from '@monorepo-admin-core/types'
import { defineStore } from 'pinia'
import { closeAdminTab, markActiveAdminTabs } from './route-tab'

/** 持久化快照的版本号 */
const PERSISTENCE_VERSION = 1

/** 默认的标签页持久化 `sessionStorage` key */
export const DEFAULT_ADMIN_TAB_STORAGE_KEY = '@monorepo-admin-core/layout-effect:open-tabs'

/** `sessionStorage` 中的标签页持久化结构 */
interface PersistedAdminTabState {
  /** 持久化的 `PersistedAdminTab` 快照列表 */
  tabs: PersistedAdminTab[]
  /** 持久化快照的版本号 */
  version: typeof PERSISTENCE_VERSION
}

/** `useAdminTabStore` 的状态结构 */
interface AdminTabStoreState {
  /** 当前激活标签的 `key` */
  activeKey: string
  /** 是否已经完成标签页初始化 */
  initialized: boolean
  /** 当前布局中的标签页记录 */
  records: AdminTabRecord[]
  /** 每个标签页对应的刷新版本号 */
  refreshVersions: Record<string, number>
  /** 已经渲染过的标签页 `key` 集合 */
  renderedKeys: Set<string>
  /** 每个标签页中各滚动元素的滚动位置 */
  scrollPositions: Record<string, Record<string, AdminTabScrollPosition>>
  /** 当前标签页使用的 `sessionStorage` key */
  storageKey: string
}

/** 重置标签页状态时的可选配置 */
export interface ResetAdminTabsOptions {
  /** 是否清理 `sessionStorage` 中的标签页数据 */
  clearPersisted?: boolean
  /** 需要额外清理的应用级 `sessionStorage` key */
  storageKey?: string
}

/** 标签页滚动元素的水平和垂直滚动位置 */
export interface AdminTabScrollPosition {
  /** 水平滚动偏移量 */
  left: number
  /** 垂直滚动偏移量 */
  top: number
}

/** 管理布局标签页运行时状态的 Pinia store */
export const useAdminTabStore = defineStore('admin-layout-tabs', {
  state: (): AdminTabStoreState => ({
    activeKey: '',
    initialized: false,
    records: [],
    refreshVersions: {},
    renderedKeys: new Set<string>(),
    scrollPositions: {},
    storageKey: DEFAULT_ADMIN_TAB_STORAGE_KEY,
  }),

  getters: {
    /** 返回当前 `activeKey` 对应的标签页记录 */
    activeRecord: (state) => state.records.find((item) => item.key === state.activeKey),
    /** 返回所有 iframe 标签页记录 */
    iframeTabs: (state) => state.records.filter((item) => Boolean(item.iframeSrc)),
    /** 返回允许缓存的普通页面标签页记录 */
    keepAlivePageTabs: (state) => state.records.filter((item) => item.keepAlive && !item.iframeSrc),
    /** 返回带有当前激活状态的标签页列表，唯一标签仅在展示时视为固定 */
    tabs: (state) => {
      const tabs = markActiveAdminTabs(state.records, state.activeKey)
      return tabs.length === 1 ? tabs.map((tab) => ({ ...tab, pinned: true })) : tabs
    },
  },

  actions: {
    /** 初始化指定 `storageKey` 的标签页状态
     * @param key 当前应用使用的 `sessionStorage` key
     * @param restoredRecords 从持久化数据恢复的标签页记录
     */
    initialize(key: string, restoredRecords: readonly AdminTabRecord[]) {
      if (this.initialized && this.storageKey === key) return

      // 切换 `storageKey` 时重建所有运行时索引
      this.storageKey = key
      this.records = dedupeRecords(restoredRecords)
      this.refreshVersions = {}
      this.renderedKeys.clear()
      this.scrollPositions = {}
      this.initialized = true
      persistTabs(this)
    },

    /** 读取并校验指定 `key` 对应的持久化标签页快照
     * @param key 待读取的 `sessionStorage` key
     * @returns 校验通过的 `PersistedAdminTab` 列表
     */
    readPersistedTabs(key: string): PersistedAdminTab[] {
      if (typeof sessionStorage === 'undefined') return []

      try {
        const rawState = sessionStorage.getItem(key)
        if (!rawState) return []

        const state = JSON.parse(rawState) as unknown
        if (!isPersistedState(state)) {
          // 无效快照直接清理，避免下次重复解析损坏数据
          removePersistedState(key)
          return []
        }

        return state.tabs
      } catch {
        removePersistedState(key)
        return []
      }
    },

    /** 设置当前激活标签并记录其已经渲染
     * @param key 目标标签的 `key`
     */
    setActive(key: string) {
      this.activeKey = key
      this.renderedKeys.add(key)
    },

    /** 新增或更新一个标签页记录
     * @param record 待写入的 `AdminTabRecord`
     */
    upsert(record: AdminTabRecord) {
      const nextRecords = upsertRecord(this.records, record)
      const evictedActive = this.records.some((item) => item.key === this.activeKey) && !nextRecords.some((item) => item.key === this.activeKey)
      for (const previous of this.records) {
        if (nextRecords.some((item) => item.key === previous.key)) continue
        this.renderedKeys.delete(previous.key)
        delete this.refreshVersions[previous.key]
        clearScrollPositions(this, previous.key)
      }
      this.records = nextRecords
      if (evictedActive) this.activeKey = record.key
      persistTabs(this)
    },

    /** 固定或取消固定标签页，并将固定标签排列在前方
     * @param key 标签页标识
     * @param pinned 是否固定
     */
    setPinned(key: string, pinned: boolean) {
      const record = this.records.find((item) => item.key === key)
      if (!record || (this.records.length === 1 && !pinned) || Boolean(record.pinned) === pinned) return

      this.records = orderPinnedRecords(this.records.map((item) => (item.key === key ? { ...item, pinned } : item)))
      persistTabs(this)
    },

    /** 将标签页放到同一固定分组中目标标签的前后
     * @param key 被拖动的标签页标识
     * @param targetKey 目标标签页标识
     * @param placement 放在目标标签之前或之后
     */
    moveTab(key: string, targetKey: string, placement: AdminTabPlacement) {
      if (key === targetKey || this.records.length < 2) return
      const moving = this.records.find((item) => item.key === key)
      const target = this.records.find((item) => item.key === targetKey)
      if (!moving || !target || Boolean(moving.pinned) !== Boolean(target.pinned)) return

      const remaining = this.records.filter((item) => item.key !== key)
      const targetIndex = remaining.findIndex((item) => item.key === targetKey)
      const insertIndex = targetIndex + (placement === 'after' ? 1 : 0)
      if (this.records[insertIndex]?.key === key) return

      this.records = [...remaining.slice(0, insertIndex), moving, ...remaining.slice(insertIndex)]
      persistTabs(this)
    },

    /** 关闭一个标签页并返回相邻标签的 `viewPath`
     * @param key 待关闭标签的 `key`
     * @returns 当前激活标签被关闭时的下一个路由地址
     */
    close(key: string) {
      const wasActive = key === this.activeKey
      const index = this.records.findIndex((item) => item.key === key)
      const nextRecord = index === -1 ? void 0 : (this.records[index + 1] ?? this.records[index - 1])
      const result = closeAdminTab(this.records, key, this.activeKey)
      const didClose = result.tabs.length < this.records.length

      if (!didClose) return void 0

      this.records = result.tabs
      this.renderedKeys.delete(key)
      delete this.refreshVersions[key]
      clearScrollPositions(this, key)

      if (wasActive && nextRecord) {
        this.activeKey = nextRecord.key
      }

      persistTabs(this)
      return wasActive ? nextRecord?.viewPath : void 0
    },

    /** 关闭指定标签之外所有允许关闭的标签页
     * @param key 需要保留的标签页标识
     * @returns 当前标签被关闭时应跳转的路由地址
     */
    closeOthers(key: string) {
      if (!this.records.some((item) => item.key === key)) return void 0
      return this.closeByKeys(
        this.records.filter((item) => item.key !== key).map((item) => item.key),
        key,
      )
    },

    /** 关闭指定标签右侧所有允许关闭的标签页
     * @param key 作为右侧范围起点的标签页标识
     * @returns 当前标签被关闭时应跳转的路由地址
     */
    closeToRight(key: string) {
      const index = this.records.findIndex((item) => item.key === key)
      if (index === -1) return void 0
      return this.closeByKeys(
        this.records.slice(index + 1).map((item) => item.key),
        key,
      )
    },

    /** 批量关闭标签并在当前标签被关闭时返回回退路由
     * @param keys 候选关闭标签页的标识列表
     * @param fallbackKey 右键选中的标签页标识，同时作为导航回退目标
     * @returns 当前标签被关闭时应跳转的路由地址
     */
    closeByKeys(keys: readonly string[], fallbackKey: string) {
      const fallback = this.records.find((item) => item.key === fallbackKey)
      if (!fallback) return void 0

      // 回退目标必须留在列表中；固定标签和声明不可关闭的标签也不会被批量关闭。
      const closingKeys = new Set(keys)
      closingKeys.delete(fallbackKey)
      const removed = this.records.filter((item) => closingKeys.has(item.key) && !item.pinned && item.closable !== false)
      if (removed.length === 0) return void 0

      const removedKeys = new Set(removed.map((item) => item.key))
      this.records = this.records.filter((item) => !removedKeys.has(item.key))
      // 与单个关闭操作保持一致，释放已关闭页面的缓存和滚动状态。
      for (const item of removed) {
        this.renderedKeys.delete(item.key)
        delete this.refreshVersions[item.key]
        clearScrollPositions(this, item.key)
      }

      const activeClosed = removedKeys.has(this.activeKey)
      // 仅在当前页被移除时切换激活项；调用方据此执行一次路由跳转。
      if (activeClosed) this.activeKey = fallbackKey
      persistTabs(this)
      return activeClosed ? fallback.viewPath : void 0
    },

    /** 刷新指定标签页并清除其滚动位置
     * @param key 待刷新的标签的 `key`
     */
    refresh(key: string) {
      if (!this.records.some((item) => item.key === key)) return

      const version = Object.hasOwn(this.refreshVersions, key) ? this.refreshVersions[key]! : 0
      this.refreshVersions = { ...this.refreshVersions, [key]: version + 1 }
      clearScrollPositions(this, key)
    },

    /** 获取标签页当前的渲染 `key`
     * @param key 标签的 `key`
     * @returns 由标签 `key` 和刷新版本号组成的渲染 `key`
     */
    getRenderKey(key: string) {
      return `${key}:${Object.hasOwn(this.refreshVersions, key) ? this.refreshVersions[key] : 0}`
    },

    /** 判断标签页是否已经渲染过
     * @param key 标签的 `key`
     * @returns 标签页是否存在于已渲染集合
     */
    hasRendered(key: string) {
      return this.renderedKeys.has(key)
    },

    /** 保存可缓存标签页中各滚动元素的位置
     * @param key 标签的 `key`
     * @param positions 以滚动元素标识为 `key` 的位置映射
     */
    setScrollPositions(key: string, positions: Readonly<Record<string, AdminTabScrollPosition>>) {
      if (!this.records.some((item) => item.key === key && item.keepAlive)) return

      this.scrollPositions = { ...this.scrollPositions, [key]: { ...positions } }
    },

    /** 读取指定标签页保存的滚动位置
     * @param key 标签的 `key`
     * @returns 以滚动元素标识为 `key` 的位置映射
     */
    getScrollPositions(key: string) {
      return Object.hasOwn(this.scrollPositions, key) ? this.scrollPositions[key]! : {}
    },

    /** 重置内存中的标签页状态并按配置清理持久化数据
     * @param options 重置选项
     */
    reset(options: ResetAdminTabsOptions = {}) {
      const clearPersisted = options.clearPersisted ?? true
      const storageKeys = new Set([this.storageKey, options.storageKey].filter((key): key is string => Boolean(key)))

      this.activeKey = ''
      this.initialized = false
      this.records = []
      this.refreshVersions = {}
      this.renderedKeys.clear()
      this.scrollPositions = {}

      if (clearPersisted && typeof sessionStorage !== 'undefined') {
        for (const key of storageKeys) removePersistedState(key)
      }
    },
  },
})

/** 按标签页 `key` 去重并保留最后一次写入的记录
 * @param records 待去重的标签页记录
 * @returns 去重后的标签页记录
 */
function dedupeRecords(records: readonly AdminTabRecord[]) {
  return orderPinnedRecords(records.reduce<AdminTabRecord[]>((result, record) => upsertRecord(result, record), []))
}

/** 更新运行时记录，保留用户设置的固定状态并遵守路由标签数量限制
 * @param records 当前标签页记录
 * @param record 待写入的完整记录
 * @returns 更新后的标签页记录
 */
function upsertRecord(records: readonly AdminTabRecord[], record: AdminTabRecord): AdminTabRecord[] {
  // 复用 key 时替换完整快照，避免遗留上一页的 iframeSrc 或 routeName
  const existingIndex = records.findIndex((item) => item.key === record.key)
  if (existingIndex !== -1) return records.map((item, index) => (index === existingIndex ? { ...record, pinned: records[index]?.pinned ?? record.pinned } : item))
  const limit = record.meta.maxNumOfOpenTab ?? -1
  let remaining = [...records]
  if (limit > 0) {
    const siblings = records.filter((item) => item.routeName === record.routeName)
    if (siblings.length >= limit) {
      // 固定标签不参与自动回收，优先淘汰最早的普通同路由标签
      const evictable = siblings.find((item) => !item.pinned)
      if (evictable) remaining = remaining.filter((item) => item.key !== evictable.key)
    }
  }
  return orderPinnedRecords([...remaining, record])
}

/** 将固定标签稳定地排列在普通标签之前
 * @param records 当前标签页记录
 * @returns 调整顺序后的记录
 */
function orderPinnedRecords(records: readonly AdminTabRecord[]): AdminTabRecord[] {
  return [...records.filter((item) => item.pinned), ...records.filter((item) => !item.pinned)]
}

/** 将当前标签页写入最小化的持久化快照
 * @param storeState 需要持久化的 `store` 状态子集
 */
function persistTabs(storeState: Pick<AdminTabStoreState, 'initialized' | 'records' | 'storageKey'>) {
  if (!storeState.initialized || typeof sessionStorage === 'undefined') return

  // 仅持久化用户设置的固定状态，唯一标签的强制固定由 tabs getter 计算
  const state: PersistedAdminTabState = {
    tabs: storeState.records.map(({ pinned, to, viewPath }) => ({ ...(pinned ? { pinned: true } : {}), to, viewPath })),
    version: PERSISTENCE_VERSION,
  }

  try {
    sessionStorage.setItem(storeState.storageKey, JSON.stringify(state))
  } catch {
    // 浏览器禁用存储或配额耗尽时，`Tab` 仍保持当前内存行为
  }
}

/** 清除指定标签页的滚动位置
 * @param storeState 包含滚动位置的 store 状态子集
 * @param key 标签的 `key`
 */
function clearScrollPositions(storeState: Pick<AdminTabStoreState, 'scrollPositions'>, key: string) {
  if (!(key in storeState.scrollPositions)) return

  const nextPositions = { ...storeState.scrollPositions }
  delete nextPositions[key]
  storeState.scrollPositions = nextPositions
}

/** 校验持久化快照是否符合当前版本的数据结构
 * @param value 待校验的未知数据
 * @returns 数据是否为有效的 `PersistedAdminTabState`
 */
function isPersistedState(value: unknown): value is PersistedAdminTabState {
  if (!isRecord(value) || value.version !== PERSISTENCE_VERSION || !Array.isArray(value.tabs)) return false

  return value.tabs.every(
    (item) =>
      isRecord(item) &&
      typeof item.to === 'string' &&
      Boolean(item.to) &&
      typeof item.viewPath === 'string' &&
      Boolean(item.viewPath) &&
      (item.pinned === undefined || typeof item.pinned === 'boolean'),
  )
}

/** 判断未知值是否为非空对象
 * @param value 待判断的未知值
 * @returns 值是否为对象记录
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** 删除指定的持久化标签页快照
 * @param key 待删除的 `sessionStorage` key
 */
function removePersistedState(key: string) {
  try {
    sessionStorage.removeItem(key)
  } catch {
    // 浏览器禁用存储时只清理内存状态
  }
}
