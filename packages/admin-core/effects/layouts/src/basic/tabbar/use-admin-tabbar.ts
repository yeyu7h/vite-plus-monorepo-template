import type { AdminTabRecord } from '@monorepo-admin-core/types'
import type { RouteLocationNormalizedLoaded, Router } from 'vue-router'
import { storeToRefs } from 'pinia'
import { watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { AdminRouteMeta } from '@monorepo-admin-core/types'
import { createAdminTabRecord } from '../../navigation/route-tab'
import { normalizeAdminNavigationPath } from '../../navigation/shared'
import { DEFAULT_ADMIN_TAB_STORAGE_KEY, useAdminTabStore } from '../../stores'

export interface UseAdminTabbarOptions {
  storageKey?: string
}

/**
 * 管理布局层 Tabbar 的路由驱动状态
 */
export function useAdminTabbar(options: UseAdminTabbarOptions = {}) {
  const router = useRouter()
  const route = useRoute()
  const tabStore = useAdminTabStore()
  const { activeKey, tabs } = storeToRefs(tabStore)
  const storageKey = options.storageKey ?? DEFAULT_ADMIN_TAB_STORAGE_KEY

  if (!tabStore.initialized || tabStore.storageKey !== storageKey) {
    const restoredRecords = tabStore
      .readPersistedTabs(storageKey)
      .map((item) => createTabRecordFromPath(item.viewPath, router))
      .filter((item): item is AdminTabRecord => Boolean(item))

    tabStore.initialize(storageKey, restoredRecords)
  }

  watch(
    () => route.fullPath,
    () => {
      const currentTab = createCurrentRouteTab()
      if (!currentTab) {
        tabStore.setActive(route.fullPath)
        return
      }

      // 同一路径重复进入时只更新标签内容 不追加重复标签
      tabStore.setActive(currentTab.key)
      tabStore.upsert(currentTab)
    },
    { immediate: true },
  )

  /**
   * 切换到指定标签页
   * @param key 目标标签标识
   */
  async function selectTab(key: string) {
    const tab = tabStore.records.find((item) => item.key === key)
    if (!tab) return

    await router.push(tab.viewPath)
  }

  /**
   * 关闭指定标签页 如果关闭的是当前页 则跳到相邻标签
   * @param key 待关闭标签标识
   */
  async function closeTab(key: string) {
    const nextActiveTarget = tabStore.close(key)

    if (nextActiveTarget) {
      await router.push(nextActiveTarget)
    }
  }

  /**
   * 刷新当前激活标签页
   * @param key 待刷新标签标识
   */
  function refreshTab(key: string) {
    if (key !== activeKey.value) return
    tabStore.refresh(key)
  }

  /**
   * 将当前路由解析为标签页结构
   */
  function createCurrentRouteTab() {
    return createAdminTabRecord(
      {
        meta: route.meta as AdminRouteMeta,
        path: route.fullPath,
        tabPath: resolveRouteTabPath(route),
      },
      {
        resolveRoute: (path) => {
          const resolved = router.resolve(path)

          // 重新包一层统一结构 让 route-tab helper 不直接依赖 vue-router 的具体类型
          return {
            meta: resolved.meta as AdminRouteMeta,
            path: resolved.fullPath,
          }
        },
      },
    )
  }

  return {
    activeKey,
    closeTab,
    refreshTab,
    selectTab,
    tabs,
  }
}

function createTabRecordFromPath(path: string, router: Router) {
  const resolved = router.resolve(path)

  // 只恢复当前账号重新注册后的权限路由，未知地址会落到 fallback，不能变成旧 Tab
  if (!resolved.matched.some((record) => record.meta.source === 'access')) return void 0

  return createAdminTabRecord(
    {
      meta: resolved.meta as AdminRouteMeta,
      path: resolved.fullPath,
      tabPath: resolveRouteTabPath(resolved),
    },
    {
      resolveRoute: (path) => {
        const resolved = router.resolve(path)

        // 初始 tab 和运行时新增 tab 走同一套解析逻辑 避免首屏与后续行为不一致
        return {
          meta: resolved.meta as AdminRouteMeta,
          path: resolved.fullPath,
        }
      },
    },
  )
}

function resolveRouteTabPath(route: Pick<RouteLocationNormalizedLoaded, 'fullPath' | 'meta'>) {
  if (typeof route.meta.tabPath === 'string') {
    return normalizeAdminNavigationPath(route.meta.tabPath)
  }

  return route.fullPath
}
