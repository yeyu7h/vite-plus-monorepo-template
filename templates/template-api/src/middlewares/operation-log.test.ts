import { Hono } from 'hono'
import type { AdminBindings } from '@monorepo/server-core'
import { expect, it, vi } from 'vite-plus/test'

import { operationLog } from './operation-log'

const logs = vi.hoisted(() => ({ info: vi.fn<(data: Record<string, unknown>, message: string) => void>(), warn: vi.fn<(data: Record<string, unknown>, message: string) => void>() }))
vi.mock('@/lib/services/logger', () => ({ operationLogger: logs }))
vi.mock('@/lib/core/rate-limit-factory', () => ({ getClientIp: () => '127.0.0.1' }))

it('audits user creation without storing its password or changing the handler input', async () => {
  const app = new Hono<AdminBindings>()
  app.use('*', async (c, next) => {
    c.set('jwtPayload', { sub: 'actor', roles: ['admin'] })
    await next()
  })
  app.use('*', operationLog())
  app.post('/system/users', async (c) => {
    const body = await c.req.json<{ username: string; password: string }>()
    expect(body.password).toBe('original-password')
    return c.json({ username: body.username, accessToken: 'response-secret' }, 201)
  })
  const response = await app.request('/system/users?token=query-secret', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'alice', password: 'original-password' }),
  })
  expect(response.status).toBe(201)
  await expect.poll(() => logs.info.mock.calls.length).toBe(1)
  expect(logs.info).toHaveBeenCalledWith(
    expect.objectContaining({
      body: { username: 'alice', password: '[REDACTED]' },
      params: { token: '[REDACTED]' },
      response: { username: 'alice', accessToken: '[REDACTED]' },
    }),
    '操作日志',
  )
})
