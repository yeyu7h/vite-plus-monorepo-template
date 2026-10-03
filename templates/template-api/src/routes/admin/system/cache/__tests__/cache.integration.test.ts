import { jwt } from 'hono/jwt'
import { testClient } from 'hono/testing'
import { afterAll, beforeAll, describe, expect, it } from 'vite-plus/test'

import env from '@/env'
import { HttpStatusCodes } from '@monorepo/server-core'
import { enforcerPromise } from '@/lib/services/casbin'
import redisClient from '@/lib/services/redis'
import { authorize } from '@/middlewares/authorize'
import cacheRouter from '@/routes/admin/system/cache/cache.index'
import { getAdminToken, getAuthHeaders, getUserToken } from '~/tests/auth-utils'
import { createTestApp } from '~/tests/utils/test-app'

if (env.NODE_ENV !== 'test') throw new Error("NODE_ENV must be 'test'")

const client = testClient(
  createTestApp()
    .use('/system/cache/*', jwt({ secret: env.ADMIN_JWT_SECRET, alg: 'HS256' }))
    .use('/system/cache/*', authorize)
    .route('/', cacheRouter),
)

const suffix = crypto.randomUUID()
const dictKey = `dict:cache_test_${suffix}`
const paramKey = `param:cache_test_${suffix}`
const protectedKey = `cache_test:protected:${suffix}`

describe('system cache management', () => {
  let adminToken: string
  let userToken: string

  beforeAll(async () => {
    adminToken = await getAdminToken()
    userToken = await getUserToken()
    await redisClient.set(dictKey, '{"items":[]}', 'EX', 120)
    await redisClient.set(paramKey, 'cached value', 'EX', 120)
    await redisClient.set(protectedKey, 'keep me', 'EX', 120)
  })

  afterAll(async () => {
    await redisClient.del(dictKey, paramKey, protectedKey)
  })

  it('lists only the selected cache category with a preview and TTL', async () => {
    let cursor = '0'
    let found = false
    for (let page = 0; page < 100; page++) {
      const response = await client.system.cache.$get({ query: { category: 'dict', cursor } }, { headers: getAuthHeaders(adminToken) })
      expect(response.status).toBe(HttpStatusCodes.OK)
      if (response.status !== HttpStatusCodes.OK) return
      const json = await response.json()
      expect(json.data.items.some((item) => item.key === paramKey || item.key === protectedKey)).toBe(false)
      found ||= json.data.items.some((item) => item.key === dictKey && item.preview === '{"items":[]}' && !item.truncated)
      cursor = json.data.cursor
      if (found || !json.data.hasMore) break
    }
    expect(found).toBe(true)
  })

  it('rejects keys outside the cache whitelist', async () => {
    const response = await client.system.cache[':key'].$delete({ param: { key: protectedKey } }, { headers: getAuthHeaders(adminToken) })
    expect(response.status).toBe(HttpStatusCodes.BAD_REQUEST)
    expect(await redisClient.get(protectedKey)).toBe('keep me')
  })

  it('restricts cache management to admins', async () => {
    const response = await client.system.cache.$get({ query: { category: 'dict', cursor: '0' } }, { headers: getAuthHeaders(userToken) })
    expect(response.status).toBe(HttpStatusCodes.FORBIDDEN)

    const enforcer = await enforcerPromise
    const added = await enforcer.addPolicy('user', '/system/cache', 'GET')
    try {
      const delegated = await client.system.cache.$get({ query: { category: 'dict', cursor: '0' } }, { headers: getAuthHeaders(userToken) })
      expect(delegated.status).toBe(HttpStatusCodes.FORBIDDEN)
    } finally {
      if (added) await enforcer.removePolicy('user', '/system/cache', 'GET')
    }
  })

  it('clears one key and a category without touching other Redis data', async () => {
    const single = await client.system.cache[':key'].$delete({ param: { key: dictKey } }, { headers: getAuthHeaders(adminToken) })
    expect(single.status).toBe(HttpStatusCodes.OK)
    expect(await redisClient.get(dictKey)).toBeNull()

    const bulk = await client.system.cache.clear.$post({ json: { category: 'param' } }, { headers: getAuthHeaders(adminToken) })
    expect(bulk.status).toBe(HttpStatusCodes.OK)
    expect(await redisClient.get(paramKey)).toBeNull()
    expect(await redisClient.get(protectedKey)).toBe('keep me')
  })
})
