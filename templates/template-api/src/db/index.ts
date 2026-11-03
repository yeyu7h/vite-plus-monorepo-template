import { drizzle } from 'drizzle-orm/postgres-js'

import postgres from 'postgres'
import env from '@/env'

import { createLazySingleton } from '@monorepo/server-core'
import { relations } from './relations'

export const getQueryClient = createLazySingleton(
  'postgres',
  () =>
    postgres(env.DATABASE_URL, {
      max: env.DB_POOL_SIZE, // Maximum connections in the pool / 连接池最大连接数
      idle_timeout: 45, // 45s idle connection timeout / 45 秒连接空闲超时
      connect_timeout: 30, // 30s connection timeout / 30 秒连接超时
      max_lifetime: 60 * 30, // 30min maximum connection lifetime / 30 分钟连接最大生命周期
      transform: {
        undefined: null, // Convert empty values to null / 空值转换为 null
      },
      connection: {
        statement_timeout: 15000, // 15s statement timeout / 15 秒语句超时
        lock_timeout: 10000, // 10s lock wait timeout / 10 秒锁等待超时
      },
    }),
  { destroy: (sql) => sql.end() },
)

const db = drizzle({
  client: getQueryClient(),
  relations,
  // Casing is configured in schema declarations (drizzle-orm v1 RC1) using snakeCase.table(...) / casing 已迁移到 schema 声明级别（drizzle-orm v1 RC1），使用 snakeCase.table(...)
  logger: false, // Or env.NODE_ENV !== "production" / 或者 env.NODE_ENV !== "production"
})

export default db
