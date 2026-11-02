import { describe, expect, it } from 'vite-plus/test'
import { ZodError } from 'zod'
import { objectStorageEnvSchema, objectStorageSummary, resolveObjectStorageConfig } from './config'
import { parseStorageCorsOrigins } from './initialization'

const legacy = { ACCESS_KEY_ID: 'test-key', SECRET_ACCESS_KEY: 'test-secret', ENDPOINT: 'https://account.r2.cloudflarestorage.com', BUCKET_NAME: 'app-files' }

describe('object storage configuration', () => {
  it('keeps legacy R2 configuration valid without a provider', () => {
    expect(resolveObjectStorageConfig(objectStorageEnvSchema.parse(legacy))).toMatchObject({
      provider: 'r2',
      region: 'auto',
      forcePathStyle: false,
      endpoint: legacy.ENDPOINT,
      presignEndpoint: legacy.ENDPOINT,
    })
  })

  it('selects RustFS defaults and accepts empty optional Compose values', () => {
    const env = objectStorageEnvSchema.parse({ ...legacy, STORAGE_PROVIDER: 'rustfs', STORAGE_REGION: '', STORAGE_FORCE_PATH_STYLE: '', STORAGE_PRESIGN_ENDPOINT: '', STORAGE_PUBLIC_BASE_URL: '' })
    expect(resolveObjectStorageConfig(env)).toMatchObject({ provider: 'rustfs', region: 'us-east-1', forcePathStyle: true, presignEndpoint: legacy.ENDPOINT, publicBaseUrl: undefined })
  })

  it('honors an explicit false instead of coercing the string to true', () => {
    const env = objectStorageEnvSchema.parse({
      ...legacy,
      STORAGE_PROVIDER: 'rustfs',
      STORAGE_REGION: 'custom-region',
      STORAGE_FORCE_PATH_STYLE: 'false',
      STORAGE_PRESIGN_ENDPOINT: 'https://s3.example.com',
      STORAGE_PUBLIC_BASE_URL: 'https://img.example.com/app-files/',
    })
    expect(resolveObjectStorageConfig(env)).toMatchObject({
      region: 'custom-region',
      forcePathStyle: false,
      presignEndpoint: 'https://s3.example.com',
      publicBaseUrl: 'https://img.example.com/app-files',
    })
  })

  it.each([
    { STORAGE_PROVIDER: 'rustf' },
    { STORAGE_PROVIDER: '' },
    { ACCESS_KEY_ID: '' },
    { SECRET_ACCESS_KEY: ' ' },
    { BUCKET_NAME: '' },
    { ENDPOINT: 'invalid' },
    { ENDPOINT: 'ftp://example.com' },
    { ENDPOINT: 'https://key:secret@example.com' },
    { ENDPOINT: 'https://example.com?token=secret' },
    { STORAGE_FORCE_PATH_STYLE: '0' },
    { STORAGE_PRESIGN_ENDPOINT: 'invalid' },
    { STORAGE_PUBLIC_BASE_URL: 'https://example.com/#fragment' },
  ])('rejects invalid or incomplete settings: %j', (settings) => {
    expect(objectStorageEnvSchema.safeParse({ ...legacy, ...settings }).success).toBe(false)
  })

  it('omits credentials from the startup summary', () => {
    const summary = objectStorageSummary(resolveObjectStorageConfig(objectStorageEnvSchema.parse(legacy)))
    expect(summary).toMatchObject({ provider: 'r2', endpointHost: 'account.r2.cloudflarestorage.com', bucket: 'app-files' })
    expect(JSON.stringify(summary)).not.toContain(legacy.ACCESS_KEY_ID)
    expect(JSON.stringify(summary)).not.toContain(legacy.SECRET_ACCESS_KEY)
  })

  it('parses a comma-separated list of browser origins', () => {
    expect(parseStorageCorsOrigins('http://localhost:5173, https://admin.example.com')).toEqual(['http://localhost:5173', 'https://admin.example.com'])
    expect(parseStorageCorsOrigins(undefined)).toEqual([])
    expect(() => parseStorageCorsOrigins('https://admin.example.com/path')).toThrow(ZodError)
    expect(() => parseStorageCorsOrigins('invalid')).toThrow(ZodError)
  })
})
