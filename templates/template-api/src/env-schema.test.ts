import { describe, expect, it } from 'vite-plus/test'
import { envSchema } from './env-schema'

const base = {
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/app',
  REDIS_URL: 'redis://localhost:6379/0',
  ADMIN_JWT_SECRET: 'test-admin-secret-at-least-32-characters',
  CLIENT_JWT_SECRET: 'test-client-secret-at-least-32-characters',
  STORAGE_PROVIDER: 'none',
}

describe('application environment', () => {
  it('starts without storage credentials and accepts an empty optional Sentry DSN', () => {
    expect(envSchema.parse({ ...base, SENTRY_DSN: '' })).toMatchObject({ PORT: 9999, DB_POOL_SIZE: 10, STORAGE_PROVIDER: 'none', SENTRY_DSN: undefined })
  })

  it('requires complete settings when storage is enabled', () => {
    const result = envSchema.safeParse({ ...base, STORAGE_PROVIDER: 'rustfs' })
    expect(result.success).toBe(false)
    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toContain('ACCESS_KEY_ID')
  })

  it.each([
    { DATABASE_URL: '' },
    { DATABASE_URL: 'https://database.example.com' },
    { REDIS_URL: 'postgresql://localhost/app' },
    { REDIS_URL: 'not-a-url' },
    { PORT: 0 },
    { PORT: 65536 },
    { PORT: 9999.5 },
    { DB_POOL_SIZE: 0 },
    { ADMIN_JWT_SECRET: 'short' },
    { CLIENT_JWT_SECRET: 'short' },
    { CLIENT_JWT_SECRET: base.ADMIN_JWT_SECRET },
    { MINIAPP_APPS: '{invalid' },
    { MINIAPP_APPS: '{"wx":{"provider":"wechat","appId":"wx"}}' },
    { USER_UID_PREFIX: '0' },
    { CLIENT_ACCESS_TOKEN_SECONDS: 0 },
    { CLIENT_SESSION_SECONDS: 0 },
    { SENTRY_DSN: 'invalid' },
    { STORAGE_PROVIDER: 'typo' },
  ])('rejects invalid configuration in development and production: %j', (settings) => {
    expect(envSchema.safeParse({ ...base, NODE_ENV: 'development', ...settings }).success).toBe(false)
    expect(envSchema.safeParse({ ...base, NODE_ENV: 'production', ...settings }).success).toBe(false)
  })

  it('accepts TLS service URLs', () => {
    expect(envSchema.safeParse({ ...base, DATABASE_URL: 'postgres://app:secret@db.example.com/app?sslmode=require', REDIS_URL: 'rediss://app:secret@redis.example.com:6380/1' }).success).toBe(true)
  })

  it('validates the WeChat registry without exposing application credentials', () => {
    expect(envSchema.parse({ ...base, MINIAPP_APPS: '' }).MINIAPP_APPS).toEqual({})
    const configured = envSchema.parse({ ...base, MINIAPP_APPS: JSON.stringify({ wx: { provider: 'wechat', appId: 'wx-123', appSecret: 'example-secret' } }) })
    expect(configured.MINIAPP_APPS.wx).toEqual({ provider: 'wechat', appId: 'wx-123', appSecret: 'example-secret' })
    const invalid = envSchema.safeParse({ ...base, MINIAPP_APPS: JSON.stringify({ wx: { provider: 'other', appId: 'wx-123', appSecret: 'example-secret' } }) })
    expect(invalid.success).toBe(false)
    expect(JSON.stringify(invalid.error?.issues)).not.toContain('example-secret')
  })
})
