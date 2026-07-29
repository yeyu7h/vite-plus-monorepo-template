import type { RelationsConfig, RelationsHelper } from '../types'

export const menuRelations = (r: RelationsHelper) =>
  ({
    systemMenuGroups: {
      menus: r.many.systemMenus({
        from: r.systemMenuGroups.id,
        to: r.systemMenus.groupId,
      }),
    },
    systemMenus: {
      parent: r.one.systemMenus({
        from: r.systemMenus.parentId,
        to: r.systemMenus.id,
        alias: 'system_menu_parent',
      }),
      children: r.many.systemMenus({
        from: r.systemMenus.id,
        to: r.systemMenus.parentId,
        alias: 'system_menu_parent',
      }),
      group: r.one.systemMenuGroups({
        from: r.systemMenus.groupId,
        to: r.systemMenuGroups.id,
      }),
      roles: r.many.systemRoles({
        from: r.systemMenus.id.through(r.systemMenuRoles.menuId),
        to: r.systemRoles.id.through(r.systemMenuRoles.roleId),
      }),
    },
  }) satisfies RelationsConfig
