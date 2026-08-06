import type { StatusType } from '@/lib/enums'

import { index, integer, snakeCase, varchar } from 'drizzle-orm/pg-core'

import { createInsertSchema, createSelectSchema } from 'drizzle-orm/zod'

import { z } from 'zod'
import { baseColumns } from '@/db/schema/_shard/base-columns'
import { Status } from '@/lib/enums'
import { StatusDescriptions } from '@/lib/schemas'

/** 管理端菜单分组。 */
export const systemMenuGroups = snakeCase.table(
  'system_menu_groups',
  {
    ...baseColumns,
    id: varchar({ length: 64 }).notNull().primaryKey(),
    label: varchar({ length: 128 }).notNull(),
    order: integer().default(0).notNull(),
    status: varchar({ length: 16 }).$type<StatusType>().default(Status.ENABLED).notNull(),
  },
  (table) => [index('system_menu_groups_status_idx').on(table.status)],
)

export const selectSystemMenuGroupsSchema = createSelectSchema(systemMenuGroups, {
  id: (schema) => schema.meta({ description: '菜单分组ID' }),
  label: (schema) => schema.meta({ description: '菜单分组标题' }),
  order: (schema) => schema.meta({ description: '菜单分组排序' }),
  status: z.enum([Status.ENABLED, Status.DISABLED]).meta({ description: StatusDescriptions.SYSTEM }),
})

export const insertSystemMenuGroupsSchema = createInsertSchema(systemMenuGroups, {
  id: (schema) => schema.min(1).max(64),
  label: (schema) => schema.min(1).max(128),
  status: z.enum([Status.ENABLED, Status.DISABLED]),
}).omit({
  createdAt: true,
  createdBy: true,
  updatedAt: true,
  updatedBy: true,
})
