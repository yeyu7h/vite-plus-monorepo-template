import type { MenuTypeType } from '@/lib/enums'

import { sql } from 'drizzle-orm'
import { boolean, check, index, integer, jsonb, primaryKey, snakeCase, text, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-orm/zod'
import { z } from 'zod'

import { baseColumns } from '@/db/schema/_shard/base-columns'
import { MenuType } from '@/lib/enums'

import { systemRoles } from './roles'

export type SystemMenuIcon = string | { dark?: string; light: string }
export type SystemMenuContentMode = 'default' | 'full'

export const systemMenuGroups = snakeCase.table(
  'system_menu_groups',
  {
    ...baseColumns,
    name: varchar({ length: 128 }).notNull(),
    order: integer().default(0).notNull(),
  },
  (table) => [uniqueIndex('system_menu_groups_name_uidx').on(table.name), index('system_menu_groups_order_idx').on(table.order)],
)

export const systemMenus = snakeCase.table(
  'system_menus',
  {
    ...baseColumns,
    parentId: uuid().references((): AnyPgColumn => systemMenus.id, { onDelete: 'restrict' }),
    groupId: uuid().references(() => systemMenuGroups.id, { onDelete: 'restrict' }),
    type: varchar({ length: 16 }).$type<MenuTypeType>().notNull(),
    title: varchar({ length: 128 }).notNull(),
    path: varchar({ length: 254 }),
    icon: jsonb().$type<SystemMenuIcon>(),
    order: integer().default(0).notNull(),
    activePath: varchar({ length: 254 }),
    contentMode: varchar({ length: 16 }).$type<SystemMenuContentMode>(),
    description: text(),
    externalLink: varchar({ length: 2048 }),
    hideInBreadcrumb: boolean().default(false).notNull(),
    hideInMenu: boolean().default(false).notNull(),
    hideInTab: boolean().default(false).notNull(),
    iframeSrc: varchar({ length: 2048 }),
    ignoreAccess: boolean().default(false).notNull(),
    keepAlive: boolean().default(false).notNull(),
    menuVisibleWithForbidden: boolean().default(false).notNull(),
    showActiveTabBorder: boolean().default(false).notNull(),
    tabPath: varchar({ length: 254 }),
    permissionCode: varchar({ length: 128 }),
    resource: varchar({ length: 254 }),
    action: varchar({ length: 64 }),
  },
  (table) => [
    index('system_menus_parent_order_idx').on(table.parentId, table.order),
    index('system_menus_group_order_idx').on(table.groupId, table.order),
    index('system_menus_type_idx').on(table.type),
    uniqueIndex('system_menus_path_uidx')
      .on(table.path)
      .where(sql`${table.path} is not null`),
    uniqueIndex('system_menus_permission_code_uidx')
      .on(table.permissionCode)
      .where(sql`${table.permissionCode} is not null`),
    uniqueIndex('system_menus_resource_action_uidx')
      .on(table.resource, table.action)
      .where(sql`${table.resource} is not null and ${table.action} is not null`),
    check(
      'system_menus_type_fields_check',
      sql`(
        (${table.type} = 'BUTTON' and ${table.path} is null and ${table.permissionCode} is not null and ${table.resource} is not null and ${table.action} is not null)
        or
        (${table.type} = 'PAGE' and ${table.path} is not null and ${table.resource} is null and ${table.action} is null)
        or
        (${table.type} <> 'BUTTON' and ${table.type} <> 'PAGE' and ${table.path} is not null and ${table.permissionCode} is null and ${table.resource} is null and ${table.action} is null)
      )`,
    ),
    check('system_menus_external_link_check', sql`${table.type} <> 'EXTERNAL' or ${table.externalLink} is not null`),
    check('system_menus_iframe_src_check', sql`${table.type} <> 'IFRAME' or ${table.iframeSrc} is not null`),
    check('system_menus_parent_self_check', sql`${table.parentId} is null or ${table.parentId} <> ${table.id}`),
  ],
)

export const systemMenuRoles = snakeCase.table(
  'system_menu_roles',
  {
    menuId: uuid()
      .notNull()
      .references(() => systemMenus.id, { onDelete: 'cascade' }),
    roleId: varchar({ length: 64 })
      .notNull()
      .references(() => systemRoles.id, { onDelete: 'cascade' }),
    policyManaged: boolean().default(false).notNull(),
  },
  (table) => [primaryKey({ columns: [table.menuId, table.roleId] }), index('system_menu_roles_role_id_idx').on(table.roleId)],
)

export const selectSystemMenuGroupSchema = createSelectSchema(systemMenuGroups)
export const insertSystemMenuGroupSchema = createInsertSchema(systemMenuGroups).omit({
  id: true,
  createdAt: true,
  createdBy: true,
  updatedAt: true,
  updatedBy: true,
})

export const selectSystemMenuSchema = createSelectSchema(systemMenus, {
  type: z.enum([MenuType.DIRECTORY, MenuType.PAGE, MenuType.EXTERNAL, MenuType.IFRAME, MenuType.BUTTON]),
  contentMode: z.enum(['default', 'full']).nullable(),
})

export const insertSystemMenuSchema = createInsertSchema(systemMenus, {
  type: z.enum([MenuType.DIRECTORY, MenuType.PAGE, MenuType.EXTERNAL, MenuType.IFRAME, MenuType.BUTTON]),
  contentMode: z.enum(['default', 'full']).nullable().optional(),
}).omit({
  id: true,
  createdAt: true,
  createdBy: true,
  updatedAt: true,
  updatedBy: true,
})
