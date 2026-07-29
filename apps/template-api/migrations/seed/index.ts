import { hash } from '@node-rs/argon2'
import { eq } from 'drizzle-orm'
import db from '@/db'
import { systemUsers, systemRoles, casbinRule, systemUserRoles, systemMenuGroups, systemMenus } from '@/db/schema'
import { MenuType, Status } from '@/lib/enums/common'

// Use logger, avoid console.log. This is only for seed scripts, console is allowed when necessary / 使用 logger，避免 console.log。这里只为 seed 脚本，允许必要时用 console，但建议更换 logger
const logPrefix = '[数据种子]'

async function seedUsers() {
  try {
    console.info(`${logPrefix} 开始写入用户...`)
    const adminPasswordHash = await hash('123456')
    const userPasswordHash = await hash('123456')

    let [adminUser] = await db
      .insert(systemUsers)
      .values({
        username: 'admin',
        password: adminPasswordHash,
        nickName: '管理员',
        status: Status.ENABLED,
        builtIn: true,
      })
      .onConflictDoNothing()
      .returning()

    // If insert conflicts, query from database / 如果插入冲突，从数据库查询
    if (!adminUser) {
      ;[adminUser] = await db.select().from(systemUsers).where(eq(systemUsers.username, 'admin'))
    }

    let [regularUser] = await db
      .insert(systemUsers)
      .values({
        username: 'user',
        password: userPasswordHash,
        nickName: '普通用户',
        status: Status.ENABLED,
        builtIn: false,
      })
      .onConflictDoNothing()
      .returning()

    // If insert conflicts, query from database / 如果插入冲突，从数据库查询
    if (!regularUser) {
      ;[regularUser] = await db.select().from(systemUsers).where(eq(systemUsers.username, 'user'))
    }

    console.info(`${logPrefix} 已创建用户 admin (${adminUser?.id}), user (${regularUser?.id})`)
    return { adminUser, regularUser }
  } catch (error) {
    console.error(`${logPrefix} 写入用户失败:`, error)
    return { adminUser: null, regularUser: null }
  }
}

async function seedRoles() {
  try {
    console.info(`${logPrefix} 开始写入角色...`)

    let [adminRole] = await db
      .insert(systemRoles)
      .values({
        id: 'admin',
        name: '管理员',
        description: '系统管理员角色，拥有所有权限',
        status: Status.ENABLED,
      })
      .onConflictDoNothing()
      .returning()

    // If insert conflicts, query from database / 如果插入冲突，从数据库查询
    if (!adminRole) {
      ;[adminRole] = await db.select().from(systemRoles).where(eq(systemRoles.id, 'admin'))
    }

    let [userRole] = await db
      .insert(systemRoles)
      .values({
        id: 'user',
        name: '普通用户',
        description: '普通用户角色，拥有基本权限',
        status: Status.ENABLED,
      })
      .onConflictDoNothing()
      .returning()

    // If insert conflicts, query from database / 如果插入冲突，从数据库查询
    if (!userRole) {
      ;[userRole] = await db.select().from(systemRoles).where(eq(systemRoles.id, 'user'))
    }

    console.info(`${logPrefix} 已创建角色 admin (${adminRole?.id}), user (${userRole?.id})`)
    return { adminRole, userRole }
  } catch (error) {
    console.error(`${logPrefix} 写入角色失败:`, error)
    return { adminRole: null, userRole: null }
  }
}

async function seedUserRoles(users: any, roles: any) {
  try {
    console.info(`${logPrefix} 开始写入用户-角色关联...`)
    if (!users?.adminUser || !users?.regularUser || !roles?.adminRole || !roles?.userRole) {
      console.warn(`${logPrefix} 跳过用户-角色关联：未找到用户或角色`)
      return
    }
    await db
      .insert(systemUserRoles)
      .values({
        userId: users.adminUser.id,
        roleId: roles.adminRole.id,
      })
      .onConflictDoNothing()
    await db
      .insert(systemUserRoles)
      .values({
        userId: users.regularUser.id,
        roleId: roles.userRole.id,
      })
      .onConflictDoNothing()
    console.info(`${logPrefix} 已创建用户-角色关联`)
  } catch (error) {
    console.error(`${logPrefix} 写入用户-角色关联失败:`, error)
  }
}

async function seedCasbinRules(roles: any) {
  try {
    console.info(`${logPrefix} 开始写入 Casbin 规则...`)
    if (!roles?.adminRole) {
      console.warn(`${logPrefix} 跳过 Casbin 规则 seed：未找到 admin 角色`)
      return
    }

    const adminRules = [
      { v1: '/system/roles', v2: 'GET' },
      { v1: '/system/roles', v2: 'POST' },
      { v1: '/system/roles/{id}', v2: 'DELETE' },
      { v1: '/system/roles/{id}', v2: 'GET' },
      { v1: '/system/roles/{id}', v2: 'PATCH' },
      { v1: '/system/roles/{id}/permissions', v2: 'GET' },
      { v1: '/system/roles/{id}/permissions', v2: 'PUT' },
      { v1: '/system/roles/{id}/menu-permissions', v2: 'GET' },
      { v1: '/system/roles/{id}/menu-permissions', v2: 'PUT' },
      { v1: '/system/users', v2: 'GET' },
      { v1: '/system/users', v2: 'POST' },
      { v1: '/system/users/{id}', v2: 'DELETE' },
      { v1: '/system/users/{id}', v2: 'GET' },
      { v1: '/system/users/{id}', v2: 'PATCH' },
      { v1: '/system/users/{id}/roles', v2: 'PUT' },
      { v1: '/system/dicts', v2: 'GET' },
      { v1: '/system/dicts', v2: 'POST' },
      { v1: '/system/dicts/{id}', v2: 'DELETE' },
      { v1: '/system/dicts/{id}', v2: 'GET' },
      { v1: '/system/dicts/{id}', v2: 'PATCH' },
      { v1: '/system/params', v2: 'GET' },
      { v1: '/system/params', v2: 'POST' },
      { v1: '/system/params/{id}', v2: 'DELETE' },
      { v1: '/system/params/{id}', v2: 'GET' },
      { v1: '/system/params/{id}', v2: 'PATCH' },
      { v1: '/system/menu-groups', v2: 'GET' },
      { v1: '/system/menu-groups', v2: 'POST' },
      { v1: '/system/menu-groups/{id}', v2: 'PATCH' },
      { v1: '/system/menu-groups/{id}', v2: 'DELETE' },
      { v1: '/system/menus/tree', v2: 'GET' },
      { v1: '/system/menus', v2: 'POST' },
      { v1: '/system/menus/{id}/children', v2: 'POST' },
      { v1: '/system/menus/{id}', v2: 'PATCH' },
      { v1: '/system/menus/{id}', v2: 'DELETE' },
    ]

    await db
      .insert(casbinRule)
      .values(
        adminRules.map((rule) => ({
          ptype: 'p',
          v0: 'admin',
          v1: rule.v1,
          v2: rule.v2,
          v3: '',
          v4: '',
          v5: '',
        })),
      )
      .onConflictDoNothing()

    console.info(`${logPrefix} 已为 admin 角色创建 ${adminRules.length} 条 Casbin 规则`)
  } catch (error) {
    console.error(`${logPrefix} 写入 Casbin 规则失败:`, error)
    throw error
  }
}

async function seedMenus(roles: any) {
  try {
    console.info(`${logPrefix} 开始写入菜单...`)
    if (!roles?.adminRole) {
      console.warn(`${logPrefix} 跳过菜单 seed：未找到 admin 角色`)
      return
    }

    await db
      .insert(systemMenuGroups)
      .values([
        { name: '工作台', order: 10 },
        { name: '运维', order: 20 },
        { name: '系统管理', order: 30 },
        { name: '链接', order: 40 },
      ])
      .onConflictDoNothing()

    const groups = await db.select().from(systemMenuGroups)
    const groupId = (name: string) => groups.find((group) => group.name === name)?.id

    await db
      .insert(systemMenus)
      .values([
        { type: MenuType.DIRECTORY, title: 'Dashboard', path: '/dashboard', icon: 'i-lucide-layout-dashboard', groupId: groupId('工作台'), order: 10 },
        { type: MenuType.DIRECTORY, title: '报表', path: '/reports', icon: 'i-lucide-chart-column', groupId: groupId('工作台'), order: 20 },
        {
          type: MenuType.DIRECTORY,
          title: '监控',
          path: '/monitor',
          icon: {
            dark: 'https://raw.githubusercontent.com/Koolson/Qure/refs/heads/master/IconSet/Color/Apple.png',
            light: 'https://raw.githubusercontent.com/Koolson/Qure/refs/heads/master/IconSet/Color/Apple.png',
          },
          groupId: groupId('运维'),
          order: 30,
        },
        { type: MenuType.PAGE, title: '用户列表', path: '/user/', icon: 'i-lucide-users', groupId: groupId('工作台'), keepAlive: true, order: 40 },
        { type: MenuType.PAGE, title: '地图', path: '/map', icon: 'i-lucide-map', groupId: groupId('运维'), showActiveTabBorder: true, order: 35 },
        { type: MenuType.DIRECTORY, title: '权限演示', path: '/access', icon: 'i-lucide-key-round', groupId: groupId('工作台'), order: 45 },
        { type: MenuType.DIRECTORY, title: '系统', path: '/system', icon: 'i-lucide-settings', groupId: groupId('系统管理'), order: 50 },
        {
          type: MenuType.IFRAME,
          title: 'Tailwind CSS 文档',
          path: '/tailwindcss/document',
          iframeSrc: 'https://tailwindcss.com/docs',
          icon: 'i-lucide-book-open-text',
          groupId: groupId('链接'),
          keepAlive: true,
          showActiveTabBorder: true,
          order: 55,
        },
        {
          type: MenuType.EXTERNAL,
          title: 'Vite+ 文档',
          path: '/docs/vite-plus',
          externalLink: 'https://viteplus.dev/guide/',
          icon: 'i-lucide-book-open',
          groupId: groupId('链接'),
          order: 60,
        },
        { type: MenuType.PAGE, title: '无效菜单示例', path: '/not-exists', icon: 'i-lucide-circle-alert', order: 999 },
      ])
      .onConflictDoNothing()

    let menus = await db.select().from(systemMenus)
    const byPath = (path: string) => menus.find((menu) => menu.path === path)

    await db
      .insert(systemMenus)
      .values([
        {
          type: MenuType.PAGE,
          title: '工作台',
          path: '/dashboard/workbench',
          parentId: byPath('/dashboard')?.id,
          icon: 'i-lucide-monitor',
          keepAlive: true,
          order: 10,
        },
        { type: MenuType.PAGE, title: '销售报表', path: '/reports/sales', parentId: byPath('/reports')?.id, icon: 'i-lucide-chart-no-axes-combined', order: 10 },
        {
          type: MenuType.PAGE,
          title: '任务监控',
          path: '/monitor/jobs',
          parentId: byPath('/monitor')?.id,
          icon: {
            dark: 'https://raw.githubusercontent.com/Koolson/Qure/refs/heads/master/IconSet/Color/App_Store.png',
            light: 'https://raw.githubusercontent.com/Koolson/Qure/refs/heads/master/IconSet/Color/App_Store.png',
          },
          order: 10,
        },
        {
          type: MenuType.PAGE,
          title: '可见但无权限',
          path: '/access/menu-visible-403',
          parentId: byPath('/access')?.id,
          icon: 'i-lucide-eye-off',
          menuVisibleWithForbidden: true,
          order: 10,
        },
        { type: MenuType.PAGE, title: '角色管理', path: '/system/role', parentId: byPath('/system')?.id, icon: 'i-lucide-shield', order: 10 },
        {
          type: MenuType.PAGE,
          title: '菜单管理',
          path: '/system/menu',
          parentId: byPath('/system')?.id,
          icon: 'i-lucide-list-tree',
          contentMode: 'full',
          order: 15,
        },
        {
          type: MenuType.DIRECTORY,
          title: '设置中心',
          path: '/system/settings',
          parentId: byPath('/system')?.id,
          icon: 'i-lucide-sliders-horizontal',
          order: 20,
        },
      ])
      .onConflictDoNothing()

    menus = await db.select().from(systemMenus)

    await db
      .insert(systemMenus)
      .values([
        {
          type: MenuType.PAGE,
          title: '主题设置',
          path: '/system/settings/theme',
          parentId: byPath('/system/settings')?.id,
          activePath: '/system/settings',
          hideInMenu: true,
          tabPath: '/system/settings',
          order: 30,
        },
        {
          type: MenuType.PAGE,
          title: '通知设置',
          path: '/system/settings/notification',
          parentId: byPath('/system/settings')?.id,
          activePath: '/system/settings',
          description: '邮件、站内信和安全提醒',
          hideInMenu: true,
          tabPath: '/system/settings',
          order: 40,
        },
        {
          type: MenuType.PAGE,
          title: '账户设置',
          path: '/system/settings/account',
          parentId: byPath('/system/settings')?.id,
          description: '修改密码、绑定邮箱和手机号',
          order: 41,
        },
      ])
      .onConflictDoNothing()

    menus = await db.select().from(systemMenus)
    const menuPageId = byPath('/system/menu')?.id
    if (menuPageId) {
      await db
        .insert(systemMenus)
        .values([
          {
            type: MenuType.BUTTON,
            title: '新增菜单',
            parentId: menuPageId,
            permissionCode: 'system:menu:create',
            resource: '/system/menus',
            action: 'POST',
            order: 10,
          },
          {
            type: MenuType.BUTTON,
            title: '新增下级',
            parentId: menuPageId,
            permissionCode: 'system:menu:create-child',
            resource: '/system/menus/{id}/children',
            action: 'POST',
            order: 20,
          },
          {
            type: MenuType.BUTTON,
            title: '编辑菜单',
            parentId: menuPageId,
            permissionCode: 'system:menu:update',
            resource: '/system/menus/{id}',
            action: 'PATCH',
            order: 30,
          },
          {
            type: MenuType.BUTTON,
            title: '删除菜单',
            parentId: menuPageId,
            permissionCode: 'system:menu:delete',
            resource: '/system/menus/{id}',
            action: 'DELETE',
            order: 40,
          },
          {
            type: MenuType.BUTTON,
            title: '新增菜单分组',
            parentId: menuPageId,
            permissionCode: 'system:menu-group:create',
            resource: '/system/menu-groups',
            action: 'POST',
            order: 50,
          },
          {
            type: MenuType.BUTTON,
            title: '编辑菜单分组',
            parentId: menuPageId,
            permissionCode: 'system:menu-group:update',
            resource: '/system/menu-groups/{id}',
            action: 'PATCH',
            order: 60,
          },
          {
            type: MenuType.BUTTON,
            title: '删除菜单分组',
            parentId: menuPageId,
            permissionCode: 'system:menu-group:delete',
            resource: '/system/menu-groups/{id}',
            action: 'DELETE',
            order: 70,
          },
        ])
        .onConflictDoNothing()
    }

    const rolePageId = byPath('/system/role')?.id
    if (rolePageId) {
      await db
        .insert(systemMenus)
        .values([
          {
            type: MenuType.BUTTON,
            title: '新增角色',
            parentId: rolePageId,
            permissionCode: 'system:role:create',
            resource: '/system/roles',
            action: 'POST',
            order: 10,
          },
          {
            type: MenuType.BUTTON,
            title: '编辑角色',
            parentId: rolePageId,
            permissionCode: 'system:role:update',
            resource: '/system/roles/{id}',
            action: 'PATCH',
            order: 20,
          },
          {
            type: MenuType.BUTTON,
            title: '删除角色',
            parentId: rolePageId,
            permissionCode: 'system:role:delete',
            resource: '/system/roles/{id}',
            action: 'DELETE',
            order: 30,
          },
          {
            type: MenuType.BUTTON,
            title: '配置角色按钮权限',
            parentId: rolePageId,
            permissionCode: 'system:role:permission-update',
            resource: '/system/roles/{id}/menu-permissions',
            action: 'PUT',
            order: 40,
          },
        ])
        .onConflictDoNothing()
    }

    console.info(`${logPrefix} 已创建 ${menus.length} 个菜单节点`)
  } catch (error) {
    console.error(`${logPrefix} 写入菜单失败:`, error)
    throw error
  }
}

async function main() {
  // Track whether any seed data insertion failed / 标记整体 process 是否有 seed 失败
  let hasError = false
  console.info(`${logPrefix} 🚀 开始种子数据写入...`)
  // Each seed has its own try-catch, any failure does not affect the next / 每个 seed 单独 try-catch，任何失败不影响下一个
  let users: any = {}
  let roles: any = {}
  try {
    users = await seedUsers()
  } catch {
    hasError = true
  }
  try {
    roles = await seedRoles()
  } catch {
    hasError = true
  }
  try {
    await seedUserRoles(users, roles)
  } catch {
    hasError = true
  }
  try {
    await seedMenus(roles)
  } catch {
    hasError = true
  }
  try {
    await seedCasbinRules(roles)
  } catch {
    hasError = true
  }

  if (hasError) {
    console.error(`${logPrefix} ❌ 部分数据种子写入失败，请检查上方日志`)
    process.exit(1)
  } else {
    console.info(`${logPrefix} 🎉 全部数据种子写入成功！`)
    process.exit(0)
  }
}

void main()
