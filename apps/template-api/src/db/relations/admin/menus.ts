import type { RelationsConfig, RelationsHelper } from '../types'

/** 菜单分组、菜单自关联和菜单-角色多对多关系。 */
export const menuRelations = (r: RelationsHelper) =>
  ({
    systemMenuGroups: {
      menus: r.many.systemMenus(),
    },
    systemMenus: {
      group: r.one.systemMenuGroups({
        from: r.systemMenus.groupId,
        to: r.systemMenuGroups.id,
      }),
      parent: r.one.systemMenus({
        alias: 'system_menu_hierarchy',
        from: r.systemMenus.parentId,
        to: r.systemMenus.id,
      }),
      children: r.many.systemMenus({
        alias: 'system_menu_hierarchy',
        from: r.systemMenus.id,
        to: r.systemMenus.parentId,
      }),
      roles: r.many.systemRoles({
        from: r.systemMenus.id.through(r.systemMenuRoles.menuId),
        to: r.systemRoles.id.through(r.systemMenuRoles.roleId),
      }),
    },
    systemRoles: {
      menus: r.many.systemMenus({
        from: r.systemRoles.id.through(r.systemMenuRoles.roleId),
        to: r.systemMenus.id.through(r.systemMenuRoles.menuId),
      }),
    },
  }) satisfies RelationsConfig
