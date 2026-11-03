import { z } from 'zod'
import { objectStorageEnvSchema } from '@/lib/services/object-storage/config'

function serviceUrl(protocols: string[]) {
  return z
    .string()
    .trim()
    .url()
    .refine(
      (value) => {
        try {
          const url = new URL(value)
          return protocols.includes(url.protocol) && Boolean(url.hostname)
        } catch {
          return false
        }
      },
      `连接地址协议必须为 ${protocols.join(' 或 ')}`,
    )
}

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(9999),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    DATABASE_URL: serviceUrl(['postgres:', 'postgresql:']),
    DB_POOL_SIZE: z.coerce.number().int().positive().default(10),
    REDIS_URL: serviceUrl(['redis:', 'rediss:']),
    ADMIN_JWT_SECRET: z.string().min(32, 'JWT密钥长度至少32字符,建议使用强随机字符串'),
    SENTRY_DSN: z.preprocess((value) => (typeof value === 'string' && !value.trim() ? undefined : value), serviceUrl(['http:', 'https:']).optional()),
    TRUSTED_PROXY_IPS: z.string().default('private'),
  })
  .and(objectStorageEnvSchema)

export type Env = z.infer<typeof envSchema>
