import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { addSeconds, formatISO } from 'date-fns'
import { storageClientConfig } from './config'
import type { ObjectStorageConfig } from './config'
import { objectKeySchema } from './object-key'

export type GenerateUploadUrlParams = { fileName: string; fileType?: string; expiresIn?: number }
export type GenerateDownloadUrlParams = { fileName: string; expiresIn?: number }
export type PresignedUrlResult = { url: string; expiresAt: string }
export type PutObjectParams = { key: string; body: Uint8Array | string; contentType?: string; cacheControl?: string }

function validateKey(key: string) {
  objectKeySchema.parse(key)
}

export function createObjectStorage(config: ObjectStorageConfig) {
  const client = new S3Client(storageClientConfig(config))
  // Sign the exact URL the caller will use; replacing its hostname later invalidates SigV4 / 对调用方实际使用的 URL 签名；之后替换主机名会使 SigV4 失效
  const signer = config.presignEndpoint === config.endpoint ? client : new S3Client(storageClientConfig(config, config.presignEndpoint))

  function getPublicUrl(key: string): string | null {
    validateKey(key)
    return config.publicBaseUrl ? `${config.publicBaseUrl}/${key.split('/').map(encodeURIComponent).join('/')}` : null
  }

  async function presign(command: PutObjectCommand | GetObjectCommand, expiresIn: number): Promise<PresignedUrlResult> {
    if (!Number.isInteger(expiresIn) || expiresIn < 1 || expiresIn > 604800) throw new Error('预签名有效期必须在 1 至 604800 秒之间')
    const url = await getSignedUrl(signer, command, { expiresIn })
    return { url, expiresAt: formatISO(addSeconds(new Date(), expiresIn)) }
  }

  return {
    getPublicUrl,
    generateUploadUrl({ fileName, fileType, expiresIn = 3600 }: GenerateUploadUrlParams) {
      validateKey(fileName)
      return presign(new PutObjectCommand({ Bucket: config.bucket, Key: fileName, ContentType: fileType }), expiresIn)
    },
    generateDownloadUrl({ fileName, expiresIn = 3600 }: GenerateDownloadUrlParams) {
      validateKey(fileName)
      return presign(new GetObjectCommand({ Bucket: config.bucket, Key: fileName }), expiresIn)
    },
    async putObject({ key, body, contentType, cacheControl }: PutObjectParams) {
      validateKey(key)
      await client.send(new PutObjectCommand({ Bucket: config.bucket, Key: key, Body: body, ContentType: contentType, CacheControl: cacheControl }))
      return { key, url: getPublicUrl(key) }
    },
    async deleteObject(key: string) {
      validateKey(key)
      await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }))
    },
    destroy() {
      client.destroy()
      if (signer !== client) signer.destroy()
    },
  }
}
