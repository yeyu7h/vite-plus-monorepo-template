import { z } from 'zod'
import { objectStorageEnvSchema } from '@/lib/services/object-storage/config'
import { miniappAppsSchema } from '@/lib/services/miniapp-auth/config'

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
    CLIENT_JWT_SECRET: z.string().min(32, 'JWT密钥长度至少32字符,建议使用强随机字符串'),
    MINIAPP_APPS: z
      .string()
      .default('{}')
      .transform((value, ctx) => {
        try {
          const parsed = miniappAppsSchema.safeParse(JSON.parse(value.trim() || '{}'))
          if (parsed.success) return parsed.data
        } catch {
          // Do not expose configuration values in errors.
        }
        ctx.addIssue({ code: 'custom', message: 'MINIAPP_APPS 必须是有效的微信小程序配置 JSON，详情见登录接入文档' })
        return z.NEVER
      }),
    USER_UID_PREFIX: z
      .string()
      .regex(/^[1-9]$/)
      .default('1'),
    CLIENT_ACCESS_TOKEN_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
    CLIENT_SESSION_SECONDS: z.coerce.number().int().min(3600).max(2592000).default(604800),
    SENTRY_DSN: z.preprocess((value) => (typeof value === 'string' && !value.trim() ? undefined : value), serviceUrl(['http:', 'https:']).optional()),
    TRUSTED_PROXY_IPS: z.string().default('private'),
  })
  .refine((value) => value.CLIENT_JWT_SECRET !== value.ADMIN_JWT_SECRET, {
    path: ['CLIENT_JWT_SECRET'],
    message: '客户端与管理端必须使用不同的 JWT 密钥',
  })
  .and(objectStorageEnvSchema)

export type Env = z.infer<typeof envSchema>
