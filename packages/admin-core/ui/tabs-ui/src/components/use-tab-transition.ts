import { computed, nextTick, ref, type CSSProperties } from 'vue'

interface UseTabTransitionOptions {
  /** 关闭动画结束后触发 */
  onClosed: (id: string) => void
}

interface ClosingTabTransition {
  /** 关闭动画开始前记录的 tab 当前宽度 */
  width: number
  /** 是否已进入收缩帧，用于把宽度从记录值切换到 0px */
  collapsing: boolean
}

interface OpeningTabTransition {
  /** 新增 tab 挂载后测量得到的目标宽度 */
  width: number
  /** 是否已进入展开帧，用于把宽度从 0px 切换到目标宽度 */
  expanding: boolean
}

/**
 * 管理 Tab 打开和关闭时的宽度过渡动画状态
 * @param options
 */
export function useTabTransition(options: UseTabTransitionOptions) {
  const { tabEls, setTabElement } = createTabElementRegistry()

  // 每个 Tab 的动画状态集中保存宽度快照和下一帧阶段标记
  const closingTabs = ref<Record<string, ClosingTabTransition>>({})
  const openingTabs = ref<Record<string, OpeningTabTransition>>({})

  /**
   * 正在关闭的 Tab 的唯一标识的集合
   * - 对外保留 Set 接口，模板只关心哪些 Tab 正在关闭
   */
  const closingTabIds = computed(() => new Set(Object.keys(closingTabs.value)))

  /**
   * 启动关闭动画：锁定当前宽度，并在下一帧切换为收缩状态
   * @param id 需要关闭的 tab 唯一标识
   */
  function startTabCloseTransition(id: string) {
    if (closingTabs.value[id]) return false

    const el = tabEls.get(id)

    closingTabs.value = {
      ...closingTabs.value,
      [id]: { width: el?.offsetWidth ?? 0, collapsing: false },
    }

    void nextTick().then(() => {
      requestAnimationFrame(() => {
        const transition = closingTabs.value[id]
        if (!transition) return

        // 先渲染当前宽度，再切到 0px，让浏览器产生 width transition
        closingTabs.value = {
          ...closingTabs.value,
          [id]: { ...transition, collapsing: true },
        }
      })
    })

    return true
  }

  /**
   * 处理 width 过渡结束事件，并结束对应的打开或关闭流程
   * @param e transitionend 事件对象
   * @param id 触发过渡结束的 tab 唯一标识
   */
  function handleTabTransitionEnd(e: TransitionEvent, id: string) {
    if (e.propertyName !== 'width') return
    if (openingTabs.value[id]?.expanding) return finishTabOpenTransition(id)
    if (!closingTabs.value[id]?.collapsing) return

    finishTabTransition(id)
  }

  /**
   * 结束关闭动画：清理关闭状态和 DOM 引用，并通知调用方移除 Tab
   * @param id 已完成关闭动画的 Tab 唯一标识
   */
  function finishTabTransition(id: string) {
    if (!closingTabs.value[id]) return

    const { [id]: _, ...nextClosingTabs } = closingTabs.value
    closingTabs.value = nextClosingTabs
    tabEls.delete(id)

    options.onClosed(id)
  }

  /**
   * 根据当前动画阶段返回 `width` 样式，未处于动画中的 Tab 不返回样式
   * @param id 需要计算宽度样式的 Tab 唯一标识
   */
  function getTabTransitionStyle(id: string): CSSProperties | undefined {
    const openingTab = openingTabs.value[id]
    if (openingTab) return { width: openingTab.expanding ? `${openingTab.width}px` : '0px' }

    const closingTab = closingTabs.value[id]
    if (!closingTab) return void 0

    return { width: closingTab.collapsing ? '0px' : `${closingTab.width}px` }
  }

  /**
   * 在新增 Tab 写入列表前准备打开动画，让它先以 0px 宽度挂载
   * @param id 即将新增的 Tab 唯一标识
   */
  function prepareTabOpenTransition(id: string) {
    // 新 tab 先以 0px 进入布局，挂载后再测量自然宽度并展开
    openingTabs.value = {
      ...openingTabs.value,
      [id]: { width: 0, expanding: false },
    }
  }

  /**
   * 新 Tab 挂载后测量目标宽度，并在下一帧切换为展开状态
   * @param id 已挂载并需要展开的 Tab 唯一标识
   */
  function startTabOpenTransition(id: string) {
    const transition = openingTabs.value[id]

    if (!transition) return false
    if (transition.expanding) return false

    const el = tabEls.get(id)
    openingTabs.value = {
      ...openingTabs.value,
      [id]: { ...transition, width: el ? getNaturalElementWidth(el) : 0 },
    }

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
    setTabElement,

    getTabTransitionStyle,
    handleTabTransitionEnd,

    prepareTabOpenTransition,
    startTabOpenTransition,
    startTabCloseTransition,
  }
}

function createTabElementRegistry() {
  const tabEls = new Map<string, HTMLElement>()

  /**
   * 记录 Tab 的 DOM 元素
   * @param id Tab 的唯一标识
   * @param el Tab 对应的 DOM 元素，卸载时为 `null`
   */
  function setTabElement(id: string, el: Element | null): void {
    if (el instanceof HTMLElement) return void tabEls.set(id, el)
    tabEls.delete(id)
  }

  return { tabEls, setTabElement }
}

/**
 * 获取元素的自然宽度
 * - 通过克隆元素并将其添加到 DOM 中来测量其宽度，而不影响布局
 * @param el
 * @returns
 */
function getNaturalElementWidth(el: HTMLElement) {
  const parent = el.parentElement
  if (!parent) return el.scrollWidth

  const cloneEl = el.cloneNode(true) as HTMLElement
  Object.assign<CSSStyleDeclaration, Partial<CSSStyleDeclaration>>(cloneEl.style, {
    position: 'absolute',
    visibility: 'hidden',
    pointerEvents: 'none',
    inset: 'auto',
    left: '-9999px',
    top: '-9999px',
    width: 'auto',
    transition: 'none',
  })

  parent.append(cloneEl)

  const width = cloneEl.offsetWidth

  cloneEl.remove()

  return width
}
