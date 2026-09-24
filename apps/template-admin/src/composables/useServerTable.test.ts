import { afterEach, describe, expect, test, vi } from 'vite-plus/test'
import { createApp, effectScope, nextTick, ref } from 'vue'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'

import { useServerTable } from './useServerTable'
import type { ServerTableOptions, ServerTableState } from './useServerTable'

const cleanups: Array<() => void> = []
afterEach(() => cleanups.splice(0).forEach((cleanup) => cleanup()))

function setup<Item, Query>(options: ServerTableOptions<Item, Query>) {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } })
  const app = createApp({}).use(VueQueryPlugin, { queryClient: client })
  const scope = effectScope()
  cleanups.push(() => {
    scope.stop()
    client.unmount()
    client.clear()
  })
  const table = scope.run(() => app.runWithContext(() => useServerTable(options)))!
  return { table, client }
}

describe('useServerTable', () => {
  test('applies search explicitly, refreshes repeated searches, and resets the page on filter or page-size changes', async () => {
    const status = ref('ALL')
    const queryFn = vi.fn<(query: ServerTableState & { status: string }) => Promise<{ items: string[]; total: number }>>().mockResolvedValue({ items: ['row'], total: 30 })
    const { table } = setup({
      queryKey: ['admin', 1, 'users'],
      buildQuery: (state) => ({ ...state, status: status.value }),
      queryFn,
      filterSources: [status],
    })
    await expect.poll(() => table.loading.value).toBe(false)
    table.search.value = 'alice'
    await nextTick()
    expect(queryFn).toHaveBeenCalledTimes(1)

    table.page.value = 2
    await expect.poll(() => queryFn.mock.lastCall?.[0]).toEqual({ page: 2, pageSize: 10, search: '', status: 'ALL' })
    table.applySearch()
    await expect.poll(() => queryFn.mock.lastCall?.[0]).toEqual({ page: 1, pageSize: 10, search: 'alice', status: 'ALL' })
    await expect.poll(() => table.loading.value).toBe(false)
    const calls = queryFn.mock.calls.length
    table.applySearch()
    await expect.poll(() => queryFn.mock.calls.length).toBe(calls + 1)

    table.page.value = 3
    table.search.value = 'bob'
    status.value = 'ENABLED'
    await expect.poll(() => queryFn.mock.lastCall?.[0]).toEqual({ page: 1, pageSize: 10, search: 'bob', status: 'ENABLED' })
    table.page.value = 2
    table.pageSize.value = 20
    await expect.poll(() => queryFn.mock.lastCall?.[0]).toEqual({ page: 1, pageSize: 20, search: 'bob', status: 'ENABLED' })
  })

  test('keeps rows while paging but never carries them across sessions, including late responses', async () => {
    const session = ref(1)
    const pending: Array<(result: { items: string[]; total: number }) => void> = []
    const { table } = setup({
      queryKey: () => ['admin', session.value, 'users'],
      buildQuery: (state) => state,
      queryFn: () => new Promise<{ items: string[]; total: number }>((resolve) => pending.push(resolve)),
    })
    await expect.poll(() => pending.length).toBe(1)
    pending[0]!({ items: ['session-one'], total: 20 })
    await expect.poll(() => table.items.value).toEqual(['session-one'])

    table.page.value = 2
    await expect.poll(() => pending.length).toBe(2)
    expect(table.items.value).toEqual(['session-one'])
    session.value = 2
    await expect.poll(() => pending.length).toBe(3)
    expect(table.items.value).toEqual([])
    expect(table.total.value).toBe(0)

    pending[1]!({ items: ['old-session-page-two'], total: 20 })
    await nextTick()
    expect(table.items.value).toEqual([])
    pending[2]!({ items: ['session-two'], total: 1 })
    await expect.poll(() => table.items.value).toEqual(['session-two'])
  })

  test('invalidates all pages of only the current resource and session', async () => {
    const { table, client } = setup({
      queryKey: ['admin', 2, 'users'],
      enabled: false,
      buildQuery: (state) => state,
      queryFn: async () => ({ items: [], total: 0 }),
    })
    const keys = [
      ['admin', 2, 'users', { page: 1 }],
      ['admin', 2, 'users', { page: 2 }],
      ['admin', 1, 'users', { page: 1 }],
      ['admin', 2, 'roles', { page: 1 }],
    ]
    keys.forEach((key) => client.setQueryData(key, { items: [], total: 0 }))
    await table.invalidate()
    expect(keys.map((key) => client.getQueryState(key)?.isInvalidated)).toEqual([true, true, false, false])
  })

  test('waits until enabled and exposes failures that can be retried', async () => {
    const enabled = ref(false)
    const failure = new Error('List unavailable')
    const queryFn = vi
      .fn<() => Promise<{ items: string[]; total: number }>>()
      .mockRejectedValueOnce(failure)
      .mockResolvedValue({ items: ['recovered'], total: 1 })
    const { table } = setup({ queryKey: ['items'], enabled, buildQuery: (state) => state, queryFn })
    await nextTick()
    expect(queryFn).not.toHaveBeenCalled()
    enabled.value = true
    await expect.poll(() => table.error.value).toBe(failure)
    await table.refresh()
    expect(table.error.value).toBeNull()
    expect(table.items.value).toEqual(['recovered'])
  })
})
