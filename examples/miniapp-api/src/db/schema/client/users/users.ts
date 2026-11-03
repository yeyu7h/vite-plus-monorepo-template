import { index, snakeCase, text, timestamp, varchar } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-orm/zod'
import { z } from 'zod'
import { baseColumns } from '../../_shard/base-columns'
import { Status } from '@/lib/enums'
import type { StatusType } from '@/lib/enums'

/** Business accounts shared by WeChat, Alipay and future client applications. */
export const clientUsers = snakeCase.table(
  'client_users',
  {
    ...baseColumns,
    /** Public business UID; immutable and independent of platform identity and admin accounts. */
    uid: varchar({ length: 32 }).notNull().unique('client_users_uid_unique'),
    nickname: varchar({ length: 64 }).notNull().default('用户'),
    avatar: text(),
    status: varchar({ length: 16 }).$type<StatusType>().notNull().default(Status.ENABLED),
    registerSource: varchar({ length: 32 }),
    lastLoginDate: timestamp({ mode: 'string', precision: 0 }),
  },
  (table) => [index('client_users_status_idx').on(table.status)],
)

export const selectClientUsersSchema = createSelectSchema(clientUsers, { status: z.enum([Status.ENABLED, Status.DISABLED]) })
export const insertClientUsersSchema = createInsertSchema(clientUsers).omit({
  id: true,
  uid: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  updatedBy: true,
  registerSource: true,
  lastLoginDate: true,
})
