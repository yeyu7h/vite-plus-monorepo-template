import type { PgTable } from 'drizzle-orm/pg-core'
import { createAdminRouter } from '@monorepo/server-core'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import adminParams from './params/params.index'
import adminDicts from './dicts/dicts.index'
import publicParams from '../../public/params/params.index'
import publicDicts from '../../public/dicts/dicts.index'

const state = vi.hoisted(() => ({
  records: { system_params: null, system_dicts: null } as Record<'system_params' | 'system_dicts', Record<string, unknown> | null>,
  cache: new Map<string, string>(),
  del: vi.fn<(...keys: string[]) => Promise<number>>(),
  update: vi.fn<(data: Record<string, unknown>) => void>(),
  warn: vi.fn<(data: unknown, message: string) => void>(),
}))

vi.mock('@/lib/services/logger', () => ({ default: { warn: state.warn, debug: vi.fn<(...args: unknown[]) => void>() } }))
vi.mock('@/lib/services/redis', () => ({
  default: {
    get: async (key: string) => state.cache.get(key) ?? null,
    setex: async (key: string, _ttl: number, value: string) => {
      state.cache.set(key, value)
      return 'OK'
    },
    del: state.del,
  },
}))
vi.mock('@/lib/core/create-app', async () => import('@monorepo/server-core'))
vi.mock('@/lib/core/refine-query', async () => ({ ...(await import('@monorepo/server-refine-query')), executeRefineQuery: vi.fn<() => Promise<unknown>>() }))
vi.mock('@/db', async () => {
  const { getTableName } = await import('drizzle-orm')
  function tableKey(table: PgTable) {
    const name = getTableName(table)
    if (name !== 'system_params' && name !== 'system_dicts') throw new Error(`Unexpected table ${name}`)
    return name
  }
  const operations = {
    select: () => ({ from: (table: PgTable) => ({ where: () => ({ for: async () => (state.records[tableKey(table)] ? [{ ...state.records[tableKey(table)] }] : []) }) }) }),
    insert: (table: PgTable) => ({
      values: (values: Record<string, unknown>) => ({
        returning: async () => {
          const record = { ...values, id: '00000000-0000-4000-8000-000000000001', valueType: values.valueType ?? 'STRING', status: values.status ?? 'ENABLED' }
          state.records[tableKey(table)] = record
          return [record]
        },
      }),
    }),
    update: (table: PgTable) => ({
      set: (values: Record<string, unknown>) => ({
        where: () => ({
          returning: async () => {
            state.update(values)
            const key = tableKey(table)
            const record = state.records[key]
            if (!record) return []
            const updated = { ...record, ...values }
            state.records[key] = updated
            return [updated]
          },
        }),
      }),
    }),
    delete: (table: PgTable) => ({
      where: () => ({
        returning: async () => {
          const key = tableKey(table)
          const record = state.records[key]
          state.records[key] = null
          return record ? [record] : []
        },
      }),
    }),
  }
  function query(key: keyof typeof state.records) {
    return {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        const row = state.records[key]
        return row && Object.entries(where).every(([field, value]) => row[field] === value) ? row : undefined
      },
      findMany: async ({ where }: { where: Record<string, unknown> }) => {
        const row = state.records[key]
        return row && Object.entries(where).every(([field, value]) => row[field] === value) ? [row] : []
      },
    }
  }
  return {
    default: {
      ...operations,
      transaction: async <T>(callback: (tx: typeof operations) => Promise<T>) => callback(operations),
      query: { systemParams: query('system_params'), systemDicts: query('system_dicts') },
    },
  }
})

const id = '00000000-0000-4000-8000-000000000001'
const app = createAdminRouter()
app.use('*', async (c, next) => {
  c.set('jwtPayload', { sub: 'admin-user', roles: ['admin'] })
  await next()
})
app.route('/admin', adminParams).route('/admin', adminDicts).route('/public', publicParams).route('/public', publicDicts)

function write(path: string, method: string, body?: Record<string, unknown>) {
  return app.request(path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
}

beforeEach(() => {
  state.records.system_params = { id, key: 'old_name', name: '参数', value: 'old value', valueType: 'STRING', status: 'ENABLED' }
  state.records.system_dicts = { id, code: 'old_name', name: '字典', items: [{ label: 'One', value: 'one', sort: 0 }], status: 'ENABLED' }
  state.cache.clear()
  state.update.mockClear()
  state.warn.mockClear()
  state.del.mockReset().mockImplementation(async (...keys) => keys.reduce((count, key) => count + Number(state.cache.delete(key)), 0))
})

describe.each([
  { resource: 'params', category: 'param', table: 'system_params', field: 'key', create: { key: 'new_name', name: '参数', value: 'new value', valueType: 'STRING', status: 'ENABLED' } },
  { resource: 'dicts', category: 'dict', table: 'system_dicts', field: 'code', create: { code: 'new_name', name: '字典', items: [{ label: 'One', value: 'one', sort: 0 }], status: 'ENABLED' } },
] as const)('$resource cache invalidation', ({ resource, category, table, field, create }) => {
  it('invalidates an already cached list after creation', async () => {
    state.records[table] = null
    expect((await app.request(`/public/${resource}`)).status).toBe(200)
    expect(state.cache.has(`${resource}:all`)).toBe(true)
    expect((await write(`/admin/system/${resource}`, 'POST', create)).status).toBe(201)
    expect(state.cache.has(`${resource}:all`)).toBe(false)
    expect(state.del).toHaveBeenCalledWith(`${resource}:all`, `${category}:new_name`)
    const response = await app.request(`/public/${resource}`)
    expect(await response.json()).toMatchObject({ data: [{ [field]: 'new_name' }] })
  })

  it('invalidates lists and both item names after renaming', async () => {
    await app.request(`/public/${resource}`)
    await app.request(`/public/${resource}/old_name`)
    expect(state.cache.has(`${resource}:all`)).toBe(true)
    expect(state.cache.has(`${category}:old_name`)).toBe(true)
    const response = await write(`/admin/system/${resource}/${id}`, 'PATCH', { [field]: 'new_name' })
    expect(response.status).toBe(200)
    expect(state.del).toHaveBeenCalledWith(`${resource}:all`, `${category}:old_name`, `${category}:new_name`)
    expect((await app.request(`/public/${resource}/old_name`)).status).toBe(404)
    expect((await app.request(`/public/${resource}/new_name`)).status).toBe(200)
    expect(await (await app.request(`/public/${resource}`)).json()).toMatchObject({ data: [{ [field]: 'new_name' }] })
  })

  it('removes disabled or deleted records from cached public responses', async () => {
    await app.request(`/public/${resource}`)
    await app.request(`/public/${resource}/old_name`)
    expect((await write(`/admin/system/${resource}/${id}`, 'PATCH', { status: 'DISABLED' })).status).toBe(200)
    expect(await (await app.request(`/public/${resource}`)).json()).toMatchObject({ data: [] })
    expect((await app.request(`/public/${resource}/old_name`)).status).toBe(404)

    expect((await write(`/admin/system/${resource}/${id}`, 'PATCH', { status: 'ENABLED' })).status).toBe(200)
    await app.request(`/public/${resource}`)
    await app.request(`/public/${resource}/old_name`)
    expect((await write(`/admin/system/${resource}/${id}`, 'DELETE')).status).toBe(200)
    expect(state.cache.has(`${resource}:all`)).toBe(false)
    expect(state.cache.has(`${category}:old_name`)).toBe(false)
    expect((await app.request(`/public/${resource}/old_name`)).status).toBe(404)
  })

  it('logs cache eviction failures without pretending the database write failed', async () => {
    state.del.mockRejectedValueOnce(new Error('Redis unavailable'))
    expect((await write(`/admin/system/${resource}/${id}`, 'PATCH', { name: 'updated' })).status).toBe(200)
    expect(state.warn).toHaveBeenCalledOnce()
    expect(state.records[table]?.name).toBe('updated')
  })

  it('returns 404 without clearing cache for a missing record', async () => {
    state.records[table] = null
    expect((await write(`/admin/system/${resource}/${id}`, 'PATCH', { name: 'updated' })).status).toBe(404)
    expect(state.del).not.toHaveBeenCalled()
  })
})

describe('parameter value validation', () => {
  it.each([
    { valueType: 'JSON', value: 'invalid json' },
    { valueType: 'NUMBER', value: 'abc' },
    { valueType: 'NUMBER', value: 'Infinity' },
    { valueType: 'NUMBER', value: '  ' },
    { valueType: 'BOOLEAN', value: 'yes' },
  ])('rejects invalid $valueType values during creation', async ({ valueType, value }) => {
    const response = await write('/admin/system/params', 'POST', { key: 'new_name', name: '参数', valueType, value })
    expect(response.status).toBe(422)
    expect(state.records.system_params?.key).toBe('old_name')
    expect(state.del).not.toHaveBeenCalled()
  })

  it.each([
    { valueType: 'JSON', value: '{"enabled":true}' },
    { valueType: 'JSON', value: 'null' },
    { valueType: 'NUMBER', value: '-12.5' },
    { valueType: 'BOOLEAN', value: 'false' },
    { valueType: 'STRING', value: 'plain text' },
  ])('accepts valid $valueType values', async ({ valueType, value }) => {
    expect((await write('/admin/system/params', 'POST', { key: 'new_name', name: '参数', valueType, value })).status).toBe(201)
  })

  it('validates an update containing only value against its persisted type', async () => {
    state.records.system_params = { ...state.records.system_params, valueType: 'JSON', value: '{}' }
    expect((await write(`/admin/system/params/${id}`, 'PATCH', { value: 'invalid' })).status).toBe(422)
    expect(state.update).not.toHaveBeenCalled()
    expect(state.del).not.toHaveBeenCalled()
  })

  it('validates an update containing only type against its persisted value', async () => {
    expect((await write(`/admin/system/params/${id}`, 'PATCH', { valueType: 'NUMBER' })).status).toBe(422)
    expect(state.update).not.toHaveBeenCalled()
  })

  it('validates the new value and type together when both change', async () => {
    expect((await write(`/admin/system/params/${id}`, 'PATCH', { value: '{"count":1}', valueType: 'JSON' })).status).toBe(200)
    expect(state.records.system_params).toMatchObject({ value: '{"count":1}', valueType: 'JSON' })
  })
})
