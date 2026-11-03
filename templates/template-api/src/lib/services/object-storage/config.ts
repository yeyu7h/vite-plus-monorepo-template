import { z } from 'zod'
import type { S3ClientConfig } from '@aws-sdk/client-s3'

const httpUrl = z
  .string()
  .trim()
  .url()
  .refine((value) => {
    try {
      const url = new URL(value)
      return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && !url.search && !url.hash
    } catch {
      return false
    }
  }, '必须是 HTTP(S) 地址，不能包含凭据、查询参数或片段')
const optional = <T extends z.ZodType>(schema: T) => z.preprocess((value) => (typeof value === 'string' && value.trim() === '' ? undefined : value), schema.optional())

/** Shared with the standalone RustFS initializer; keep independent of app infrastructure. */
const enabledStorageEnvSchema = z.object({
  STORAGE_PROVIDER: z.enum(['r2', 'rustfs']),
  ACCESS_KEY_ID: z.string().trim().min(1, '对象存储访问密钥不能为空'),
  SECRET_ACCESS_KEY: z
    .string()
    .min(1, '对象存储私有密钥不能为空')
    .refine((value) => value.trim().length > 0, '对象存储私有密钥不能为空'),
  ENDPOINT: httpUrl,
  BUCKET_NAME: z.string().trim().min(1, '对象存储桶名称不能为空').default('default-bucket'),
  STORAGE_REGION: optional(z.string().trim().min(1)),
  STORAGE_FORCE_PATH_STYLE: optional(z.enum(['true', 'false']).transform((value) => value === 'true')),
  STORAGE_PRESIGN_ENDPOINT: optional(httpUrl),
  STORAGE_PUBLIC_BASE_URL: optional(httpUrl),
})

export const objectStorageEnvSchema = z.preprocess(
  (value) => {
    if (value && typeof value === 'object' && (!('STORAGE_PROVIDER' in value) || value.STORAGE_PROVIDER === undefined)) {
      return { ...value, STORAGE_PROVIDER: 'r2' }
    }
    return value
  },
  z.discriminatedUnion('STORAGE_PROVIDER', [z.object({ STORAGE_PROVIDER: z.literal('none') }), enabledStorageEnvSchema]),
)

export type ObjectStorageEnv = z.infer<typeof objectStorageEnvSchema>

export function resolveObjectStorageConfig(env: ObjectStorageEnv) {
  if (env.STORAGE_PROVIDER === 'none') return null
  return {
    provider: env.STORAGE_PROVIDER,
    endpoint: env.ENDPOINT,
    presignEndpoint: env.STORAGE_PRESIGN_ENDPOINT ?? env.ENDPOINT,
    publicBaseUrl: env.STORAGE_PUBLIC_BASE_URL?.replace(/\/+$/, ''),
    region: env.STORAGE_REGION ?? (env.STORAGE_PROVIDER === 'rustfs' ? 'us-east-1' : 'auto'),
    forcePathStyle: env.STORAGE_FORCE_PATH_STYLE ?? env.STORAGE_PROVIDER === 'rustfs',
    bucket: env.BUCKET_NAME,
    credentials: { accessKeyId: env.ACCESS_KEY_ID, secretAccessKey: env.SECRET_ACCESS_KEY },
  }
}

export type ObjectStorageConfig = NonNullable<ReturnType<typeof resolveObjectStorageConfig>>

export class ObjectStorageDisabledError extends Error {
  readonly status = 503

  constructor() {
    super('对象存储未启用')
    this.name = 'ObjectStorageDisabledError'
  }
}

export function requireObjectStorageConfig(config: ObjectStorageConfig | null): ObjectStorageConfig {
  if (!config) throw new ObjectStorageDisabledError()
  return config
}

export function storageClientConfig(config: ObjectStorageConfig, endpoint = config.endpoint): S3ClientConfig {
  return {
    endpoint,
    region: config.region,
    forcePathStyle: config.forcePathStyle,
    credentials: config.credentials,
    // Presigned PUTs have no body yet; do not sign the checksum of an empty body.
    requestChecksumCalculation: 'WHEN_REQUIRED',
  }
}

/** Safe to log: access credentials and signed URLs are deliberately omitted. */
export function objectStorageSummary(config: ObjectStorageConfig | null) {
  if (!config) return { provider: 'none' }
  return {
    provider: config.provider,
    endpointHost: new URL(config.endpoint).host,
    presignHost: new URL(config.presignEndpoint).host,
    region: config.region,
    forcePathStyle: config.forcePathStyle,
    bucket: config.bucket,
  }
}
