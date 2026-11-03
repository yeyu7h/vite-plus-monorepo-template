import { describe, expect, it } from 'vite-plus/test'
import { envSchema } from './env-schema'

const base = {
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/app',
  REDIS_URL: 'redis://localhost:6379/0',
  ADMIN_JWT_SECRET: 'test-admin-secret-at-least-32-characters',
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
    { SENTRY_DSN: 'invalid' },
    { STORAGE_PROVIDER: 'typo' },
  ])('rejects invalid configuration in development and production: %j', (settings) => {
    expect(envSchema.safeParse({ ...base, NODE_ENV: 'development', ...settings }).success).toBe(false)
    expect(envSchema.safeParse({ ...base, NODE_ENV: 'production', ...settings }).success).toBe(false)
  })

  it('accepts TLS service URLs', () => {
    expect(envSchema.safeParse({ ...base, DATABASE_URL: 'postgres://app:secret@db.example.com/app?sslmode=require', REDIS_URL: 'rediss://app:secret@redis.example.com:6380/1' }).success).toBe(true)
  })
})
