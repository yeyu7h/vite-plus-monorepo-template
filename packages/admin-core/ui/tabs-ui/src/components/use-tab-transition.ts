import { computed, getCurrentScope, nextTick, onScopeDispose, ref, type CSSProperties } from 'vue'

const TAB_CLOSE_FALLBACK_DELAY = 250

interface UseTabTransitionOptions {
  /** 关闭动画结束后触发 */
  onClosed: (id: string) => void
  /** Tab 未进入动画状态时使用的 flex-basis */
  tabBasis: string
}

interface ClosingTabTransition {
  /** 是否已进入收缩帧，用于把 flex-basis 从基准值切换到 0px */
  collapsing: boolean
}

interface OpeningTabTransition {
  /** 是否已进入展开帧，用于把 flex-basis 从 0px 切换到基准值 */
  expanding: boolean
}

/**
 * 管理 Tab 打开和关闭时的宽度过渡动画状态
 * @param options
 */
export function useTabTransition(options: UseTabTransitionOptions) {
  // 每个 Tab 的动画状态集中保存下一帧阶段标记
  const closingTabs = ref<Record<string, ClosingTabTransition>>({})
  const openingTabs = ref<Record<string, OpeningTabTransition>>({})
  const closeFallbackTimers = new Map<string, ReturnType<typeof setTimeout>>()

  if (getCurrentScope()) {
    onScopeDispose(() => {
      for (const timer of closeFallbackTimers.values()) clearTimeout(timer)
      closeFallbackTimers.clear()
    })
  }

  /**
   * 正在关闭的 Tab 的唯一标识的集合
   * - 对外保留 Set 接口，模板只关心哪些 Tab 正在关闭
   */
  const closingTabIds = computed(() => new Set(Object.keys(closingTabs.value)))

  /**
   * 启动关闭动画：锁定当前 flex-basis，并在下一帧切换为收缩状态
   * @param id 需要关闭的 tab 唯一标识
   */
  function startTabCloseTransition(id: string) {
    if (closingTabs.value[id]) return false

    closingTabs.value = {
      ...closingTabs.value,
      [id]: { collapsing: false },
    }
    closeFallbackTimers.set(
      id,
      setTimeout(() => finishTabTransition(id), TAB_CLOSE_FALLBACK_DELAY),
    )

    void nextTick().then(() => {
      requestAnimationFrame(() => {
        const transition = closingTabs.value[id]
        if (!transition) return

        // 先渲染基准宽度，再切到 0px，让浏览器产生 flex-basis transition
        closingTabs.value = {
          ...closingTabs.value,
          [id]: { ...transition, collapsing: true },
        }
      })
    })

    return true
  }

  /**
   * 处理 flex-basis 过渡结束事件，并结束对应的打开或关闭流程
   * @param e transitionend 事件对象
   * @param id 触发过渡结束的 tab 唯一标识
   */
  function handleTabTransitionEnd(e: TransitionEvent, id: string) {
    if (e.propertyName !== 'flex-basis') return
    if (openingTabs.value[id]?.expanding) return finishTabOpenTransition(id)
    if (!closingTabs.value[id]?.collapsing) return

    finishTabTransition(id)
  }

  /**
   * 结束关闭动画：清理关闭状态，并通知调用方移除 Tab
   * @param id 已完成关闭动画的 Tab 唯一标识
   */
  function finishTabTransition(id: string) {
    if (!closingTabs.value[id]) return

    const fallbackTimer = closeFallbackTimers.get(id)
    if (fallbackTimer !== undefined) clearTimeout(fallbackTimer)
    closeFallbackTimers.delete(id)

    const { [id]: _, ...nextClosingTabs } = closingTabs.value
    closingTabs.value = nextClosingTabs

    options.onClosed(id)
  }

  /**
   * 根据当前动画阶段返回 `flex-basis` 样式
   * @param id 需要计算宽度样式的 Tab 唯一标识
   */
  function getTabTransitionStyle(id: string, tabBasis = options.tabBasis): CSSProperties {
    const openingTab = openingTabs.value[id]
    if (openingTab) return { flexBasis: openingTab.expanding ? tabBasis : '0px' }

    const closingTab = closingTabs.value[id]
    if (closingTab) return { flexBasis: closingTab.collapsing ? '0px' : tabBasis }

    return { flexBasis: tabBasis }
  }

  /**
   * 在新增 Tab 写入列表前准备打开动画，让它先以 0px 宽度挂载
   * @param id 即将新增的 Tab 唯一标识
   */
  function prepareTabOpenTransition(id: string) {
    // 新 tab 先以 0px 进入布局，挂载后再展开到基准宽度
    openingTabs.value = {
      ...openingTabs.value,
      [id]: { expanding: false },
    }
  }

  /**
   * 新 Tab 挂载后在下一帧切换为基准宽度
   * @param id 已挂载并需要展开的 Tab 唯一标识
   */
  function startTabOpenTransition(id: string) {
    const transition = openingTabs.value[id]

    if (!transition) return false
    if (transition.expanding) return false

    requestAnimationFrame(() => {
      const nextTransition = openingTabs.value[id]
      if (!nextTransition) return

      // 测量完成后下一帧切到目标宽度，触发展开动画
      openingTabs.value = {
        ...openingTabs.value,
        [id]: { ...nextTransition, expanding: true },
      }
    })

    return true
  }

  /**
   * 结束打开动画：清理打开状态，让 Tab 回到自然宽度布局
   * @param id 已完成打开动画的 Tab 唯一标识
   */
  function finishTabOpenTransition(id: string) {
    if (!openingTabs.value[id]) return

    const { [id]: _removedTransition, ...nextOpeningTabs } = openingTabs.value
    openingTabs.value = nextOpeningTabs
  }

  return {
    closingTabIds,

    getTabTransitionStyle,
    handleTabTransitionEnd,

    prepareTabOpenTransition,
    startTabOpenTransition,
    startTabCloseTransition,
  }
}
