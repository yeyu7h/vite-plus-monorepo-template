import pino from 'pino'
import { describe, expect, it } from 'vite-plus/test'

import { redactLogObject } from './log-redaction'

describe('log redaction', () => {
  it('redacts nested credentials, headers and tokens without changing source data', () => {
    const source = {
      body: { username: 'alice', password: 'plain-password', users: [{ new_password: 'new-secret' }] },
      params: { access_token: 'access-secret' },
      response: { refreshToken: 'refresh-secret' },
      headers: { Authorization: 'Bearer secret', Cookie: 'session=secret', 'Set-Cookie': 'session=other' },
    }
    expect(redactLogObject(source)).toEqual({
      body: { username: 'alice', password: '[REDACTED]', users: [{ new_password: '[REDACTED]' }] },
      params: { access_token: '[REDACTED]' },
      response: { refreshToken: '[REDACTED]' },
      headers: { Authorization: '[REDACTED]', Cookie: '[REDACTED]', 'Set-Cookie': '[REDACTED]' },
    })
    expect(source.body.password).toBe('plain-password')
    expect(source.response.refreshToken).toBe('refresh-secret')
  })

  it('keeps Pino error serializers usable and supports circular log objects', () => {
    const error = new Error('failed')
    const source: Record<string, unknown> = { error, password: 'secret' }
    source.self = source
    const result = redactLogObject(source)
    expect(result.password).toBe('[REDACTED]')
    expect(result.error).toBe(error)
    expect(result.self).toBe(result)
  })

  it('removes credentials at the logger boundary even outside audit middleware', () => {
    const lines: string[] = []
    const logger = pino(
      { formatters: { log: redactLogObject } },
      {
        write: (line) => {
          lines.push(line)
        },
      },
    )
    logger.info({ body: { password: 'never-log-this' }, secretAccessKey: 'storage-secret', username: 'alice' }, 'test')
    expect(lines).toHaveLength(1)
    expect(lines[0]).not.toContain('never-log-this')
    expect(lines[0]).not.toContain('storage-secret')
    expect(JSON.parse(lines[0]!)).toMatchObject({ username: 'alice', body: { password: '[REDACTED]' }, secretAccessKey: '[REDACTED]' })
  })
})
