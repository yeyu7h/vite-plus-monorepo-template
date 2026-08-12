import { nextTick } from 'vue'
import { afterEach, expect, test, vi } from 'vite-plus/test'
import { useTabTransition } from './use-tab-transition'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

test('opens a tab from zero to the configured flex basis', () => {
  let nextFrame: FrameRequestCallback | undefined
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    nextFrame = callback
    return 1
  })

  const transition = useTabTransition({ onClosed: vi.fn<(id: string) => void>(), tabBasis: '11rem' })

  transition.prepareTabOpenTransition('reports')
  expect(transition.getTabTransitionStyle('reports')).toEqual({ flexBasis: '0px' })

  expect(transition.startTabOpenTransition('reports')).toBe(true)
  nextFrame?.(0)
  expect(transition.getTabTransitionStyle('reports')).toEqual({ flexBasis: '11rem' })

  transition.handleTabTransitionEnd({ propertyName: 'flex-basis' } as TransitionEvent, 'reports')
  expect(transition.getTabTransitionStyle('reports')).toEqual({ flexBasis: '11rem' })
})

test('closes a tab from the configured flex basis to zero', async () => {
  let nextFrame: FrameRequestCallback | undefined
  const onClosed = vi.fn<(id: string) => void>()
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    nextFrame = callback
    return 1
  })

  const transition = useTabTransition({ onClosed, tabBasis: '11rem' })

  expect(transition.startTabCloseTransition('reports')).toBe(true)
  expect(transition.closingTabIds.value.has('reports')).toBe(true)
  expect(transition.getTabTransitionStyle('reports')).toEqual({ flexBasis: '11rem' })

  await nextTick()
  nextFrame?.(0)
  expect(transition.getTabTransitionStyle('reports')).toEqual({ flexBasis: '0px' })

  transition.handleTabTransitionEnd({ propertyName: 'width' } as TransitionEvent, 'reports')
  expect(onClosed).not.toHaveBeenCalled()

  transition.handleTabTransitionEnd({ propertyName: 'flex-basis' } as TransitionEvent, 'reports')
  expect(onClosed).toHaveBeenCalledExactlyOnceWith('reports')
  expect(transition.closingTabIds.value.has('reports')).toBe(false)
})

test('finishes closing when the browser omits transitionend', async () => {
  vi.useFakeTimers()
  const onClosed = vi.fn<(id: string) => void>()
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    setTimeout(() => callback(0), 0)
    return 1
  })

  const transition = useTabTransition({ onClosed, tabBasis: '11rem' })

  expect(transition.startTabCloseTransition('reports')).toBe(true)
  await nextTick()

  await vi.advanceTimersByTimeAsync(249)
  expect(onClosed).not.toHaveBeenCalled()
  expect(transition.closingTabIds.value.has('reports')).toBe(true)

  await vi.advanceTimersByTimeAsync(1)
  expect(onClosed).toHaveBeenCalledExactlyOnceWith('reports')
  expect(transition.closingTabIds.value.has('reports')).toBe(false)
})
