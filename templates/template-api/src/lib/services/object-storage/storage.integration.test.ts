import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vite-plus/test'
import { GetBucketCorsCommand, S3Client } from '@aws-sdk/client-s3'
import { getObjectStorage, objectStorageConfig } from './index'
import { requireObjectStorageConfig, storageClientConfig } from './config'
import { initializeRustfsBucket } from './initialization'

// Only loaded by the dedicated, fail-closed test:storage configuration / 仅由专用且默认拒绝的 test:storage 配置加载
const storage = getObjectStorage()
const config = requireObjectStorageConfig(objectStorageConfig)
const keys: string[] = []
const key = () => {
  const value = `integration/${randomUUID()}/白兔 #1.png`
  keys.push(value)
  return value
}
const png = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+iJ1kAAAAASUVORK5CYII=', 'base64'))
const origin = 'http://localhost:5173'

beforeAll(async () => initializeRustfsBucket(config, [origin]))
afterAll(async () => {
  try {
    await Promise.all(keys.map((value) => storage.deleteObject(value)))
  } finally {
    storage.destroy()
  }
})

describe('RustFS S3 compatibility', () => {
  it('initializes an existing bucket repeatedly and configures browser CORS', async () => {
    await initializeRustfsBucket(config, [origin])
    const client = new S3Client(storageClientConfig(config))
    try {
      const result = await client.send(new GetBucketCorsCommand({ Bucket: config.bucket }))
      expect(result.CORSRules).toEqual(expect.arrayContaining([expect.objectContaining({ AllowedOrigins: [origin], AllowedMethods: expect.arrayContaining(['GET', 'PUT', 'HEAD']) })]))
    } finally {
      client.destroy()
    }
  })

  it('uploads PNG bytes from the server and downloads the same data through a signed GET', async () => {
    const fileName = key()
    expect(await storage.putObject({ key: fileName, body: png, contentType: 'image/png', cacheControl: 'public, max-age=3600' })).toEqual({ key: fileName, url: null })
    const { url } = await storage.generateDownloadUrl({ fileName })
    const response = await fetch(url)
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('image/png')
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=3600')
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(png)
  })

  it('uploads a nonempty body through a signed PUT, supports preflight, and keeps the bucket private', async () => {
    const fileName = key()
    const { url } = await storage.generateUploadUrl({ fileName, fileType: 'image/png' })
    const preflight = await fetch(url, { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'PUT', 'Access-Control-Request-Headers': 'content-type' } })
    expect(preflight.status).toBeLessThan(300)
    expect(preflight.headers.get('Access-Control-Allow-Origin')).toBe(origin)
    const uploaded = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'image/png', Origin: origin }, body: png })
    expect(uploaded.status).toBe(200)
    const { url: download } = await storage.generateDownloadUrl({ fileName })
    const response = await fetch(download)
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(png)
    const anonymous = new URL(download)
    anonymous.search = ''
    expect((await fetch(anonymous)).status).toBe(403)
  })

  it('deletes an uploaded object', async () => {
    const fileName = key()
    await storage.putObject({ key: fileName, body: png })
    await storage.deleteObject(fileName)
    const { url } = await storage.generateDownloadUrl({ fileName })
    expect((await fetch(url)).status).toBe(404)
  })
})
