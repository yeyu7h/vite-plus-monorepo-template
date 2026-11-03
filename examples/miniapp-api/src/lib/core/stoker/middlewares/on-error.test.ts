import { Context } from 'hono'
import { describe, expect, it } from 'vite-plus/test'

import env from '@/env'

import onError from './on-error.js'

describe('onError', () => {
  it('should use NODE_ENV from context if defined', async () => {
    const req = new Request('http://localhost/')
    const context = new Context(req)
    context.env = {
      NODE_ENV: 'production',
    }
    const response = await onError(new Error('Test error'), context)

    expect(response.status).toBe(500)

    const json = await response.json()

    expect(json).toEqual({
      message: 'Test error',
      stack: undefined,
    })
  })

  it('should use NODE_ENV from process.env otherwise', async () => {
    const req = new Request('http://localhost/')
    const context = new Context(req)
    env.NODE_ENV = 'production'
    const response = await onError(new Error('Test error'), context)

    expect(response.status).toBe(500)

    const json = await response.json()

    expect(json).toEqual({
      message: 'Test error',
      stack: undefined,
    })
  })
})
