import { CreateBucketCommand, HeadBucketCommand, PutBucketCorsCommand, S3Client } from '@aws-sdk/client-s3'
import { z } from 'zod'
import { storageClientConfig } from './config.ts'
import type { ObjectStorageConfig } from './config.ts'

const originSchema = z.union([
  z.literal('*'),
  z.url().refine((value) => {
    try {
      const url = new URL(value)
      return ['http:', 'https:'].includes(url.protocol) && url.origin === value
    } catch {
      return false
    }
  }, '跨域来源必须是 HTTP(S) 源站，例如 http://localhost:5173'),
])

export function parseStorageCorsOrigins(value: string | undefined): string[] {
  return z
    .array(originSchema)
    .max(100)
    .parse(
      value
        ?.split(',')
        .map((origin) => origin.trim())
        .filter(Boolean) ?? [],
    )
}

/** Explicit provisioning only; regular application startup never creates or changes buckets. */
export async function initializeRustfsBucket(config: ObjectStorageConfig, origins: string[]) {
  if (config.provider !== 'rustfs') throw new Error('storage:init 仅用于 RustFS')
  const client = new S3Client(storageClientConfig(config))
  try {
    try {
      await client.send(new HeadBucketCommand({ Bucket: config.bucket }))
    } catch (error) {
      if (!(error instanceof Error) || !('$metadata' in error) || (error.$metadata as { httpStatusCode?: number }).httpStatusCode !== 404) throw error
      try {
        await client.send(new CreateBucketCommand({ Bucket: config.bucket }))
      } catch (creationError) {
        if (!(creationError instanceof Error) || creationError.name !== 'BucketAlreadyOwnedByYou') throw creationError
      }
    }
    if (origins.length) {
      await client.send(
        new PutBucketCorsCommand({
          Bucket: config.bucket,
          CORSConfiguration: { CORSRules: [{ AllowedOrigins: origins, AllowedMethods: ['GET', 'HEAD', 'PUT'], AllowedHeaders: ['*'], ExposeHeaders: ['ETag'], MaxAgeSeconds: 3600 }] },
        }),
      )
    }
  } finally {
    client.destroy()
  }
}
