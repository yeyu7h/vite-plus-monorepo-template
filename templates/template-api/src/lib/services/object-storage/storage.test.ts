import { afterEach, describe, expect, it } from 'vite-plus/test'
import { createObjectStorage } from './storage'
import { objectStorageEnvSchema, requireObjectStorageConfig, resolveObjectStorageConfig } from './config'

const instances: ReturnType<typeof createObjectStorage>[] = []
function setup(settings: Record<string, string> = {}) {
  const storage = createObjectStorage(
    requireObjectStorageConfig(
      resolveObjectStorageConfig(
        objectStorageEnvSchema.parse({
          ACCESS_KEY_ID: 'test-key',
          SECRET_ACCESS_KEY: 'test-secret',
          ENDPOINT: 'https://account.r2.cloudflarestorage.com',
          BUCKET_NAME: 'app-files',
          ...settings,
        }),
      ),
    ),
  )
  instances.push(storage)
  return storage
}
afterEach(() => {
  for (const storage of instances.splice(0)) storage.destroy()
})

describe('S3 object storage', () => {
  it('generates an R2 URL with legacy region and response fields', async () => {
    const result = await setup().generateDownloadUrl({ fileName: 'folder/test.png', expiresIn: 600 })
    const url = new URL(result.url)
    expect(url.hostname).toBe('app-files.account.r2.cloudflarestorage.com')
    expect(url.pathname).toBe('/folder/test.png')
    expect(url.searchParams.get('X-Amz-Credential')).toContain('/auto/s3/aws4_request')
    expect(url.searchParams.get('X-Amz-Expires')).toBe('600')
    expect(Date.parse(result.expiresAt)).toBeGreaterThan(Date.now() + 598000)
  })

  it('signs RustFS path-style URLs using the external endpoint, without an empty-body checksum', async () => {
    const storage = setup({ STORAGE_PROVIDER: 'rustfs', ENDPOINT: 'http://internal.invalid:9000', STORAGE_PRESIGN_ENDPOINT: 'https://s3.example.com' })
    const { url: signed } = await storage.generateUploadUrl({ fileName: 'avatars/白兔 1.png', fileType: 'image/png' })
    const url = new URL(signed)
    expect(url.origin).toBe('https://s3.example.com')
    expect(decodeURIComponent(url.pathname)).toBe('/app-files/avatars/白兔 1.png')
    expect(url.searchParams.get('X-Amz-Credential')).toContain('/us-east-1/s3/aws4_request')
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toContain('host')
    expect(url.searchParams.has('x-amz-checksum-crc32')).toBe(false)
    expect(url.searchParams.has('X-Amz-Signature')).toBe(true)
  })

  it('encodes object keys under a configured public prefix and keeps it separate from signed links', () => {
    const storage = setup({ STORAGE_PUBLIC_BASE_URL: 'https://img.example.com/app-files/' })
    expect(storage.getPublicUrl('avatars/小熊 #1.png')).toBe('https://img.example.com/app-files/avatars/%E5%B0%8F%E7%86%8A%20%231.png')
    expect(setup().getPublicUrl('avatars/test.png')).toBeNull()
  })

  it.each(['', '../secret', 'avatars/../secret', '/absolute', 'avatars\\secret', 'control\u0000.png'])('rejects unsafe object paths: %j', (key) => {
    const storage = setup()
    expect(() => storage.getPublicUrl(key)).toThrow('对象文件路径无效')
    expect(() => storage.generateUploadUrl({ fileName: key })).toThrow('对象文件路径无效')
  })

  it.each([0, -1, 604801, 1.5])('rejects invalid signing duration: %s', async (expiresIn) => {
    await expect(setup().generateDownloadUrl({ fileName: 'test.png', expiresIn })).rejects.toThrow('预签名有效期必须在 1 至 604800 秒之间')
  })
})
