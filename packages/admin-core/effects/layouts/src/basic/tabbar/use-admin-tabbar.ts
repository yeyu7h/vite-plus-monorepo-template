import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { closeAdminTab, createAdminTab, markActiveAdminTabs, upsertAdminTab } from '../../navigation/route-tab'
import { normalizeAdminNavigationPath } from '../../navigation/shared'

/**
 * 管理布局层 Tabbar 的路由驱动状态
 */
export function useAdminTabbar() {
  const router = useRouter()
  const route = useRoute()
  const rawTabs = ref(createInitialTabs(route, router))

  // 当前激活项要和 createAdminTab 的复用规则保持一致 不能直接拿 fullPath
  const activeKey = computed(() => createCurrentRouteTab()?.key ?? route.fullPath)
  const tabs = computed(() => markActiveAdminTabs(rawTabs.value, activeKey.value))

  watch(
    () => route.fullPath,
    () => {
      const currentTab = createCurrentRouteTab()
      if (!currentTab) return

      // 同一路径重复进入时只更新标签内容 不追加重复标签
      rawTabs.value = upsertAdminTab(rawTabs.value, currentTab)
    },
    { immediate: true },
  )

  /**
   * 切换到指定标签页
   * @param key 目标标签标识
   */
  async function selectTab(key: string) {
    const tab = rawTabs.value.find((item) => item.key === key)
    if (!tab) return

    await router.push(tab.to)
  }

  /**
   * 关闭指定标签页 如果关闭的是当前页 则跳到相邻标签
   * @param key 待关闭标签标识
   */
  async function closeTab(key: string) {
    const result = closeAdminTab(rawTabs.value, key, activeKey.value)
    rawTabs.value = result.tabs

    if (result.nextActiveTarget) {
      await router.push(result.nextActiveTarget)
    }
  }

  /**
   * 刷新当前激活标签页
   * @param key 待刷新标签标识
   */
  function refreshTab(key: string) {
    if (key !== activeKey.value) return
    router.go(0)
  }

  /**
   * 将当前路由解析为标签页结构
   */
  function createCurrentRouteTab() {
    return createAdminTab(
      {
        meta: route.meta,
        path: route.fullPath,
        tabPath: resolveRouteTabPath(route),
      },
      {
        resolveRoute: (path) => {
          const resolved = router.resolve(path)

          // 重新包一层统一结构 让 route-tab helper 不直接依赖 vue-router 的具体类型
          return {
            meta: resolved.meta,
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

/**
 * 生成 Tabbar 的初始标签页列表
 * @param route 当前路由
 * @param router 当前路由实例
 */
function createInitialTabs(route: ReturnType<typeof useRoute>, router: ReturnType<typeof useRouter>) {
  const initialTab = createAdminTab(
    {
      meta: route.meta,
      path: route.fullPath,
      tabPath: resolveRouteTabPath(route),
    },
    {
      resolveRoute: (path) => {
        const resolved = router.resolve(path)

        // 初始 tab 和运行时新增 tab 走同一套解析逻辑 避免首屏与后续行为不一致
        return {
          meta: resolved.meta,
          path: resolved.fullPath,
        }
      },
    },
  )

  return initialTab ? [initialTab] : []
}

function resolveRouteTabPath(route: ReturnType<typeof useRoute>) {
  if (typeof route.meta.tabPath === 'string') {
    return normalizeAdminNavigationPath(route.meta.tabPath)
  }

  return route.fullPath
}
