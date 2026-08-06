import type { StatusType } from '@/lib/enums'

import { boolean, index, integer, jsonb, snakeCase, text, varchar } from 'drizzle-orm/pg-core'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'

import { createInsertSchema, createSelectSchema } from 'drizzle-orm/zod'

import { z } from 'zod'
import { baseColumns } from '@/db/schema/_shard/base-columns'
import { Status } from '@/lib/enums'
import { StatusDescriptions } from '@/lib/schemas'

import { systemMenuGroups } from './menu-groups'

export const adminMenuTypes = ['directory', 'menu', 'button'] as const
export type AdminMenuType = (typeof adminMenuTypes)[number]

export type AdminMenuIcon = string | { dark?: string; light: string }

/** 管理端菜单和按钮节点。 */
export const systemMenus = snakeCase.table(
  'system_menus',
  {
    ...baseColumns,
    id: varchar({ length: 128 }).notNull().primaryKey(),
    parentId: varchar({ length: 128 }).references((): AnyPgColumn => systemMenus.id, { onDelete: 'cascade' }),
    groupId: varchar({ length: 64 }).references(() => systemMenuGroups.id, { onDelete: 'set null' }),
    type: varchar({ length: 16 }).$type<AdminMenuType>().default('menu').notNull(),
    path: varchar({ length: 255 }).notNull(),
    title: varchar({ length: 128 }).notNull(),
    description: text(),
    icon: jsonb().$type<AdminMenuIcon>(),
    activePath: varchar({ length: 255 }),
    externalLink: text(),
    iframeSrc: text(),
    contentMode: varchar({ length: 16 }).$type<'default' | 'full'>(),
    hideInBreadcrumb: boolean().default(false).notNull(),
    hideInMenu: boolean().default(false).notNull(),
    hideInTab: boolean().default(false).notNull(),
    ignoreAccess: boolean().default(false).notNull(),
    keepAlive: boolean().default(false).notNull(),
    menuVisibleWithForbidden: boolean().default(false).notNull(),
    order: integer().default(0).notNull(),
    permissionCode: varchar({ length: 128 }),
    showActiveTabBorder: boolean().default(false).notNull(),
    tabPath: varchar({ length: 255 }),
    status: varchar({ length: 16 }).$type<StatusType>().default(Status.ENABLED).notNull(),
  },
  (table) => [index('system_menus_parent_id_idx').on(table.parentId), index('system_menus_group_id_idx').on(table.groupId), index('system_menus_status_order_idx').on(table.status, table.order)],
)

export const selectSystemMenusSchema = createSelectSchema(systemMenus, {
  id: (schema) => schema.meta({ description: '菜单节点ID' }),
  parentId: (schema) => schema.meta({ description: '父菜单节点ID' }),
  groupId: (schema) => schema.meta({ description: '菜单分组ID' }),
  type: z.enum(adminMenuTypes).meta({ description: '菜单节点类型' }),
  path: (schema) => schema.meta({ description: '路由或按钮路径' }),
  title: (schema) => schema.meta({ description: '菜单标题' }),
  icon: (schema) => schema.meta({ description: '菜单图标' }),
  contentMode: z.enum(['default', 'full']).nullable().meta({ description: '页面内容布局' }),
  status: z.enum([Status.ENABLED, Status.DISABLED]).meta({ description: StatusDescriptions.SYSTEM }),
})

export const insertSystemMenusSchema = createInsertSchema(systemMenus, {
  id: (schema) => schema.min(1).max(128),
  type: z.enum(adminMenuTypes),
  path: (schema) => schema.min(1).max(255),
  title: (schema) => schema.min(1).max(128),
  contentMode: z.enum(['default', 'full']).optional(),
  status: z.enum([Status.ENABLED, Status.DISABLED]),
}).omit({
  createdAt: true,
  createdBy: true,
  updatedAt: true,
  updatedBy: true,
})
