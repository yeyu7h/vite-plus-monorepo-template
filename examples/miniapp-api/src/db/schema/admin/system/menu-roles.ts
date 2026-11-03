import { index, primaryKey, snakeCase, varchar } from 'drizzle-orm/pg-core'

import { systemMenus } from './menus'
import { systemRoles } from './roles'

/** 菜单与角色的多对多关联。没有关联角色的菜单视为公共菜单。 */
export const systemMenuRoles = snakeCase.table(
  'system_menu_roles',
  {
    menuId: varchar({ length: 128 })
      .notNull()
      .references(() => systemMenus.id, { onDelete: 'cascade' }),
    roleId: varchar({ length: 64 })
      .notNull()
      .references(() => systemRoles.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ name: 'system_menu_roles_pkey', columns: [table.menuId, table.roleId] }),
    index('system_menu_roles_menu_id_idx').on(table.menuId),
    index('system_menu_roles_role_id_idx').on(table.roleId),
  ],
)
