import { existsSync } from 'node:fs'
import path from 'node:path'
import { config } from '@dotenvx/dotenvx'
import { z } from 'zod'
import { parseEnvOrExit } from '@/utils/zod'
import { objectStorageEnvSchema } from '@/lib/services/object-storage/config'

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
    /** Admin JWT secret / 管理端JWT密钥 */
    ADMIN_JWT_SECRET: z.string().min(32, 'JWT密钥长度至少32字符,建议使用强随机字符串'),

    /** Sentry error tracking / Sentry错误追踪 */
    SENTRY_DSN: z.string().optional(),

    /** Trusted proxy IPs / 信任的代理IP */
    TRUSTED_PROXY_IPS: z.string().default('private'),
  })
  .extend(objectStorageEnvSchema.shape)

export type Env = z.infer<typeof EnvSchema>
export default parseEnvOrExit(EnvSchema)
