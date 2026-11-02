import { existsSync } from 'node:fs'
import path from 'node:path'
import { config } from '@dotenvx/dotenvx'
import { z } from 'zod'
import { miniappAppsSchema } from '@monorepo/server-miniapp-auth'
import { parseEnvOrExit } from '@/utils/zod'

const envFile = path.resolve(process.cwd(), process.env.NODE_ENV === 'test' ? '.env.test' : '.env')
if (existsSync(envFile)) {
  config({ path: envFile })
}

const EnvSchema = z
  .object({
    /** Environment variable / 环境变量 */
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    /** Port / 端口 */
    PORT: z.coerce.number().default(9999),
    /** Log level / 日志级别 */
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    /** Database connection string / 数据库连接字符串 */
    DATABASE_URL: z.string().refine((val) => process.env.NODE_ENV !== 'production' || val !== '', { message: '生产环境下数据库连接字符串不能为空' }),
    /** Database connection pool size / 数据库连接池大小 */
    DB_POOL_SIZE: z.coerce.number().int().positive().default(10),
    /** Redis connection string / Redis连接字符串 */
    REDIS_URL: z.string().refine((val) => process.env.NODE_ENV !== 'production' || val !== '', { message: '生产环境下redis连接字符串不能为空' }),
    /** Client JWT secret / 客户端JWT密钥 */
    CLIENT_JWT_SECRET: z.string().min(32, 'JWT密钥长度至少32字符,建议使用强随机字符串'),
    /** Admin JWT secret / 管理端JWT密钥 */
    ADMIN_JWT_SECRET: z.string().min(32, 'JWT密钥长度至少32字符,建议使用强随机字符串'),

    /** Server-owned application registry; never expose this value through client configuration. */
    MINIAPP_APPS: z
      .string()
      .default('{}')
      .transform((value, ctx) => {
        try {
          const parsed = miniappAppsSchema.safeParse(JSON.parse(value))
          if (parsed.success) return parsed.data
        } catch {
          /* Report configuration failure without echoing credentials. */
        }
        ctx.addIssue({ code: 'custom', message: 'MINIAPP_APPS 必须是有效的小程序应用配置 JSON，详情见登录接入文档' })
        return z.NEVER
      }),
    USER_UID_PREFIX: z
      .string()
      .regex(/^[1-9]$/)
      .default('1'),
    CLIENT_ACCESS_TOKEN_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
    CLIENT_SESSION_SECONDS: z.coerce.number().int().min(3600).max(2592000).default(604800),

    /** Cloud provider R2 access key ID / 云服务商R2访问密钥ID */
    ACCESS_KEY_ID: z.string(),
    /** Cloud provider R2 secret access key / 云服务商R2访问密钥 */
    SECRET_ACCESS_KEY: z.string(),
    /** Cloud provider R2 endpoint / 云服务商R2终端节点 */
    ENDPOINT: z.url(),
    /** Cloud provider R2 bucket name / 云服务商R2存储桶名称 */
    BUCKET_NAME: z.string().default('default-bucket'),

    /** Sentry error tracking / Sentry错误追踪 */
    SENTRY_DSN: z.string().optional(),

    /** Trusted proxy IPs / 信任的代理IP */
    TRUSTED_PROXY_IPS: z.string().default('private'),
  })
  .refine((value) => value.CLIENT_JWT_SECRET !== value.ADMIN_JWT_SECRET, {
    path: ['CLIENT_JWT_SECRET'],
    message: '客户端与管理端必须使用不同的 JWT 密钥',
  })

export type Env = z.infer<typeof EnvSchema>
export default parseEnvOrExit(EnvSchema)
