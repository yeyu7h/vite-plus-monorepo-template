import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { closeAdminTab, createAdminTab, markActiveAdminTabs, upsertAdminTab } from '../../navigation/route-tab'

/**
 * 管理布局层 Tabbar 的路由驱动状态
 */
export function useAdminTabbar() {
  const router = useRouter()
  const route = useRoute()
  const rawTabs = ref(createInitialTabs(route, router))

  // 当前激活项要和 createAdminTab 的复用规则保持一致 不能直接拿 fullPath
  const activePath = computed(() => createCurrentRouteTab()?.path ?? route.fullPath)
  const tabs = computed(() => markActiveAdminTabs(rawTabs.value, activePath.value))

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
   * @param path 目标标签路径
   */
  async function selectTab(path: string) {
    await router.push(path)
  }

  /**
   * 关闭指定标签页 如果关闭的是当前页 则跳到相邻标签
   * @param path 待关闭标签路径
   */
  async function closeTab(path: string) {
    const result = closeAdminTab(rawTabs.value, path, activePath.value)
    rawTabs.value = result.tabs

    if (result.nextActivePath) {
      await router.push(result.nextActivePath)
    }
  }

  /**
   * 刷新当前激活标签页
   * @param path 待刷新标签路径
   */
  function refreshTab(path: string) {
    if (path !== activePath.value) return
    router.go(0)
  }

  /**
   * 将当前路由解析为标签页结构
   */
  function createCurrentRouteTab() {
    return createAdminTab(
      {
        matched: route.matched,
        meta: route.meta,
        path: route.fullPath,
      },
      {
        resolveRoute: (path) => {
          const resolved = router.resolve(path)

          // 重新包一层统一结构 让 route-tab helper 不直接依赖 vue-router 的具体类型
          return {
            matched: resolved.matched,
            meta: resolved.meta,
            path: resolved.fullPath,
          }
        },
      },
    )
  }

  return {
    activePath,
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
      matched: route.matched,
      meta: route.meta,
      path: route.fullPath,
    },
    {
      resolveRoute: (path) => {
        const resolved = router.resolve(path)

        // 初始 tab 和运行时新增 tab 走同一套解析逻辑 避免首屏与后续行为不一致
        return {
          matched: resolved.matched,
          meta: resolved.meta,
          path: resolved.fullPath,
        }
      },
    },
  )

  return initialTab ? [initialTab] : []
}
