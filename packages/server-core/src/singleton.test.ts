import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

import { createAsyncSingleton, createLazySingleton, createSingleton, destroyAllSingletons, destroySingleton, getSingletonKeys, hasSingleton } from './singleton.ts'

const key = (name: string) => `server-core-test:${name}`

afterEach(async () => {
  await destroyAllSingletons()
})

describe('singleton lifecycle', () => {
  it('creates a synchronous singleton only once', () => {
    const factory = vi.fn<() => { id: number }>(() => ({ id: 1 }))
    const singletonKey = key('sync')

    const first = createSingleton(singletonKey, factory)
    const second = createSingleton(singletonKey, factory)

    expect(second).toBe(first)
    expect(factory).toHaveBeenCalledTimes(1)
    expect(hasSingleton(singletonKey)).toBe(true)
  })

  it('initializes lazy singletons on first access', () => {
    const factory = vi.fn<() => { ready: boolean }>(() => ({ ready: true }))
    const singletonKey = key('lazy')
    const getInstance = createLazySingleton(singletonKey, factory)

    expect(hasSingleton(singletonKey)).toBe(false)
    expect(getInstance()).toEqual({ ready: true })
    expect(factory).toHaveBeenCalledTimes(1)
  })

  it('deduplicates concurrent async initialization and destroys the instance', async () => {
    const destroy = vi.fn<(instance: { id: number }) => void>()
    const factory = vi.fn<() => Promise<{ id: number }>>(async () => ({ id: 2 }))
    const singletonKey = key('async')

    const [first, second] = await Promise.all([createAsyncSingleton(singletonKey, factory, { destroy }), createAsyncSingleton(singletonKey, factory, { destroy })])
    await destroySingleton(singletonKey)

    expect(second).toBe(first)
    expect(factory).toHaveBeenCalledTimes(1)
    expect(destroy).toHaveBeenCalledWith(first)
    expect(getSingletonKeys()).not.toContain(singletonKey)
  })
})
