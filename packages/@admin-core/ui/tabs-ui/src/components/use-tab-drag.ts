import type { AdminTabItem, AdminTabPlacement } from '@monorepo-admin-core/types'
import { computed, onScopeDispose, ref } from 'vue'

interface UseTabDragOptions {
  tabs: () => AdminTabItem[]
  onReorder: (key: string, targetKey: string, placement: AdminTabPlacement) => void
}

/** 管理标签拖拽预览、重排与指针清理 */
export function useTabDrag(options: UseTabDragOptions) {
  const draggingKey = ref<string | null>(null)
  const previewKeys = ref<string[] | null>(null)
  const displayedTabs = computed(() => {
    if (!previewKeys.value) return options.tabs()
    const byKey = new Map(options.tabs().map((tab) => [tab.key, tab]))
    return previewKeys.value.map((key) => byKey.get(key)).filter((tab): tab is AdminTabItem => Boolean(tab))
  })

  interface PointerDrag {
    centers: number[]
    element: HTMLElement
    key: string
    listRect: DOMRect
    order: string[]
    pinned: boolean
    pinnedCount: number
    pointerId: number
    rect: DOMRect
    startX: number
  }

  let pointerDrag: PointerDrag | null = null
  let dragGhost: HTMLElement | null = null
  let dragShield: HTMLElement | null = null
  let invalidDrop = false
  let suppressNextClick = false
  let clickResetTimer: ReturnType<typeof setTimeout> | undefined
  let returnTimer: ReturnType<typeof setTimeout> | undefined

  /** 从标签主体开始记录指针，固定与关闭按钮仍执行自身操作 */
  function startTabPointer(event: PointerEvent, key: string) {
    if (pointerDrag || dragGhost || event.button !== 0 || options.tabs().length < 2 || (event.target instanceof Element && event.target.closest('button:not(.tab-select-button)'))) return
    const element = event.currentTarget as HTMLElement
    const list = element.closest<HTMLElement>('.tab-reorder-list')
    if (!list) return

    const listRect = list.getBoundingClientRect()
    const centers = [...list.querySelectorAll<HTMLElement>('.tab-slot')].map((slot) => listRect.left + slot.offsetLeft + slot.offsetWidth / 2)
    if (centers.length !== options.tabs().length) return

    pointerDrag = {
      centers,
      element,
      key,
      listRect,
      order: options.tabs().map((tab) => tab.key),
      pinned: Boolean(options.tabs().find((tab) => tab.key === key)?.pinned),
      pinnedCount: options.tabs().filter((tab) => tab.pinned).length,
      pointerId: event.pointerId,
      rect: element.getBoundingClientRect(),
      startX: event.clientX,
    }
    try {
      element.setPointerCapture(event.pointerId)
    } catch {
      // 合成指针事件可能没有可捕获的活动指针，窗口监听仍能处理拖动。
    }
    window.addEventListener('pointermove', moveTabPointer, { passive: false })
    window.addEventListener('pointerup', finishTabPointer)
    window.addEventListener('pointercancel', cancelTabPointer)
    window.addEventListener('blur', endPointerDrag)
  }

  /** 将浮动标签的可见范围限制在 Tabbar 内 */
  function clampDragLeft(drag: PointerDrag, left: number) {
    const min = drag.listRect.left
    const max = Math.max(min, drag.listRect.right - drag.rect.width)
    return Math.min(Math.max(left, min), max)
  }

  /** 沿横轴移动拖拽预览，并按当前位置实时调整同组标签顺序 */
  function moveTabPointer(event: PointerEvent) {
    const drag = pointerDrag
    if (!drag || event.pointerId !== drag.pointerId) return
    const distanceX = event.clientX - drag.startX
    if (!draggingKey.value) {
      if (Math.abs(distanceX) < 6) return
      draggingKey.value = drag.key
      previewKeys.value = drag.order
      dragShield = document.createElement('div')
      dragShield.className = 'tab-drag-shield'
      Object.assign(dragShield.style, { position: 'fixed', inset: '0', zIndex: '2147483646', cursor: 'default', touchAction: 'none' })
      document.body.append(dragShield)
      dragGhost = drag.element.cloneNode(true) as HTMLElement
      dragGhost.classList.add('tab-drag-ghost')
      dragGhost.inert = true
      dragGhost.setAttribute('aria-hidden', 'true')
      Object.assign(dragGhost.style, {
        height: `${drag.rect.height}px`,
        left: `${clampDragLeft(drag, drag.rect.left)}px`,
        top: `${drag.rect.top}px`,
        width: `${drag.rect.width}px`,
      })
      document.body.append(dragGhost)
    }

    event.preventDefault()
    if (dragGhost) dragGhost.style.left = `${clampDragLeft(drag, drag.rect.left + distanceX)}px`

    const boundary = drag.pinnedCount > 0 && drag.pinnedCount < drag.order.length ? (drag.centers[drag.pinnedCount - 1]! + drag.centers[drag.pinnedCount]!) / 2 : null
    invalidDrop = boundary !== null && (drag.pinned ? event.clientX >= boundary : event.clientX < boundary)

    const groupStart = drag.pinned ? 0 : drag.pinnedCount
    const groupEnd = drag.pinned ? drag.pinnedCount : drag.order.length
    let destination = groupStart
    for (let index = groupStart; index < groupEnd - 1; index++) {
      if (event.clientX >= (drag.centers[index]! + drag.centers[index + 1]!) / 2) destination++
    }
    const nextOrder = invalidDrop ? drag.order : drag.order.filter((key) => key !== drag.key)
    if (!invalidDrop) nextOrder.splice(destination, 0, drag.key)
    if (!previewKeys.value?.every((key, index) => key === nextOrder[index])) previewKeys.value = nextOrder
  }

  /** 松开指针时保存有效换位，跨固定区则恢复原顺序 */
  function finishTabPointer(event: PointerEvent) {
    const drag = pointerDrag
    if (!drag || event.pointerId !== drag.pointerId) return
    if (draggingKey.value) moveTabPointer(event)
    const order = previewKeys.value
    const active = Boolean(draggingKey.value)
    const valid = active && !invalidDrop
    stopPointerTracking()
    if (!active || !order) return clearDragVisuals()

    suppressNextClick = true
    if (clickResetTimer) clearTimeout(clickResetTimer)
    clickResetTimer = setTimeout(() => (suppressNextClick = false), 0)
    if (!valid) {
      previewKeys.value = drag.order
      return animateTabTo(drag, drag.rect.left)
    }

    const oldIndex = drag.order.indexOf(drag.key)
    const newIndex = order.indexOf(drag.key)
    if (newIndex === oldIndex) return animateTabTo(drag, drag.rect.left)
    const neighborBefore = order[newIndex - 1]
    const target = neighborBefore && options.tabs().find((tab) => tab.key === neighborBefore && Boolean(tab.pinned) === drag.pinned)
    if (target) {
      animateTabTo(drag, drag.centers[newIndex]! - drag.rect.width / 2)
      options.onReorder(drag.key, target.key, 'after')
    } else if (order[newIndex + 1]) {
      animateTabTo(drag, drag.centers[newIndex]! - drag.rect.width / 2)
      options.onReorder(drag.key, order[newIndex + 1]!, 'before')
    } else {
      previewKeys.value = drag.order
      animateTabTo(drag, drag.rect.left)
    }
  }

  /** 中断拖拽并清理浮层 */
  function cancelTabPointer(event: PointerEvent) {
    const drag = pointerDrag
    if (!drag || event.pointerId !== drag.pointerId) return
    const active = Boolean(draggingKey.value)
    stopPointerTracking()
    if (active) {
      previewKeys.value = drag.order
      animateTabTo(drag, drag.rect.left)
    } else clearDragVisuals()
  }

  /** 松手后让浮动标签沿横轴落到目标槽位或返回原位置 */
  function animateTabTo(drag: PointerDrag, targetLeft: number) {
    const ghost = dragGhost
    if (!ghost) return clearDragVisuals()
    targetLeft = clampDragLeft(drag, targetLeft)

    const currentLeft = Number.parseFloat(ghost.style.left)
    if (Math.abs(currentLeft - targetLeft) < 1 || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return clearDragVisuals()

    ghost.style.transition = 'none'
    void ghost.offsetWidth
    ghost.style.transition = 'left 180ms cubic-bezier(0.2, 0.8, 0.2, 1)'
    ghost.style.left = `${targetLeft}px`
    ghost.addEventListener(
      'transitionend',
      (event) => {
        if (event.target === ghost && event.propertyName === 'left') clearDragVisuals()
      },
      { once: true },
    )
    returnTimer = setTimeout(clearDragVisuals, 240)
  }

  /** 停止监听指针，同时让归位动画仍可继续显示 */
  function stopPointerTracking() {
    window.removeEventListener('pointermove', moveTabPointer)
    window.removeEventListener('pointerup', finishTabPointer)
    window.removeEventListener('pointercancel', cancelTabPointer)
    window.removeEventListener('blur', endPointerDrag)
    const drag = pointerDrag
    if (drag) {
      try {
        drag.element.releasePointerCapture(drag.pointerId)
      } catch {
        // 指针捕获可能已因元素换位而自动释放。
      }
    }
    dragShield?.remove()
    dragShield = null
    pointerDrag = null
  }

  /** 清理浮层与排序预览 */
  function clearDragVisuals() {
    if (returnTimer) clearTimeout(returnTimer)
    returnTimer = undefined
    dragGhost?.remove()
    dragGhost = null
    draggingKey.value = null
    previewKeys.value = null
    invalidDrop = false
  }

  /** 清理全部拖动状态 */
  function endPointerDrag() {
    stopPointerTracking()
    clearDragVisuals()
  }

  /** 拖拽松手后阻止浏览器额外触发一次标签切换 */
  function consumeDragClick(event: MouseEvent) {
    if (suppressNextClick) {
      event.preventDefault()
      suppressNextClick = false
      return true
    }
    return false
  }

  onScopeDispose(() => {
    endPointerDrag()
    if (clickResetTimer) clearTimeout(clickResetTimer)
  })

  return { draggingKey, displayedTabs, startTabPointer, consumeDragClick }
}
