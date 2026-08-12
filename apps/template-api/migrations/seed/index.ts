import { hash } from '@node-rs/argon2'
import type { InferInsertModel } from 'drizzle-orm'

import { eq } from 'drizzle-orm'
import db from '@/db'
import { systemMenuRoles, systemMenus, systemUsers, systemRoles, casbinRule, systemUserRoles } from '@/db/schema'
import type { AdminMenuIcon, AdminMenuType } from '@/db/schema'
import { Status } from '@/lib/enums/common'

// Use logger, avoid console.log. This is only for seed scripts, console is allowed when necessary / 使用 logger，避免 console.log。这里只为 seed 脚本，允许必要时用 console，但建议更换 logger
const logPrefix = '[数据种子]'

type MenuSeed = {
  activePath?: string
  children?: MenuSeed[]
  contentMode?: 'default' | 'full'
  description?: string
  externalLink?: string
  hideInBreadcrumb?: boolean
  hideInMenu?: boolean
  hideInTab?: boolean
  icon?: AdminMenuIcon
  iframeSrc?: string
  id: string
  ignoreAccess?: boolean
  keepAlive?: boolean
  menuVisibleWithForbidden?: boolean
  order: number
  parentId?: string
  path: string | null
  permissionCode?: string
  showActiveTabBorder?: boolean
  tabPath?: string
  title: string
  type: AdminMenuType
}

const groupNodesSeed: MenuSeed[] = [
  { id: 'group_workspace', path: null, order: 10, title: '工作台', type: 'group' },
  { id: 'group_ops', path: null, order: 20, title: '运维', type: 'group' },
  { id: 'group_system', path: null, order: 30, title: '系统管理', type: 'group' },
  { id: 'group_links', path: null, order: 40, title: '链接', type: 'group' },
]

const menuTreeSeed: MenuSeed[] = [
  {
    id: 'dashboard',
    path: '/dashboard',
    parentId: 'group_workspace',
    icon: 'i-lucide-layout-dashboard',
    order: 10,
    title: 'Dashboard',
    type: 'directory',
    children: [{ id: 'dashboard-workbench', path: 'workbench', icon: 'i-lucide-monitor', keepAlive: true, order: 10, title: '工作台', type: 'menu' }],
  },
  {
    id: 'reports',
    path: '/reports',
    parentId: 'group_workspace',
    icon: 'i-lucide-chart-column',
    order: 20,
    title: '报表',
    type: 'directory',
    children: [{ id: 'reports-sales', path: 'sales', icon: 'i-lucide-chart-no-axes-combined', order: 10, title: '销售报表', type: 'menu' }],
  },
  {
    id: 'monitor',
    path: '/monitor',
    parentId: 'group_ops',
    icon: {
      dark: 'https://raw.githubusercontent.com/Koolson/Qure/refs/heads/master/IconSet/Color/Apple.png',
      light: 'https://raw.githubusercontent.com/Koolson/Qure/refs/heads/master/IconSet/Color/Apple.png',
    },
    order: 30,
    title: '监控',
    type: 'directory',
    children: [
      {
        id: 'monitor-jobs',
        path: 'jobs',
        icon: {
          dark: 'https://raw.githubusercontent.com/Koolson/Qure/refs/heads/master/IconSet/Color/App_Store.png',
          light: 'https://raw.githubusercontent.com/Koolson/Qure/refs/heads/master/IconSet/Color/App_Store.png',
        },
        order: 10,
        title: '任务监控',
        type: 'menu',
      },
    ],
  },
  { id: 'user', path: '/user', parentId: 'group_workspace', icon: 'i-lucide-users', keepAlive: true, order: 40, title: '用户列表', type: 'menu' },
  { id: 'map', path: '/map', parentId: 'group_ops', icon: 'i-lucide-map', order: 35, showActiveTabBorder: true, title: '地图', type: 'menu', contentMode: 'full' },
  {
    id: 'access',
    path: '/access',
    parentId: 'group_workspace',
    icon: 'i-lucide-key-round',
    order: 45,
    title: '权限演示',
    type: 'directory',
    children: [
      {
        id: 'access-menu-visible-403',
        path: 'menu-visible-403',
        icon: 'i-lucide-eye-off',
        menuVisibleWithForbidden: true,
        order: 10,
        title: '可见但无权限',
        type: 'menu',
      },
    ],
  },
  {
    id: 'system',
    path: '/system',
    parentId: 'group_system',
    icon: 'i-lucide-settings',
    order: 50,
    title: '系统',
    type: 'directory',
    children: [
      {
        id: 'system-role',
        path: 'role',
        icon: 'i-lucide-shield',
        order: 10,
        title: '角色管理',
        type: 'menu',
        children: [
          { id: 'system-role-create', path: 'create', order: 10, permissionCode: 'system:role:create', title: '创建角色', type: 'button' },
          { id: 'system-role-update', path: 'update', order: 20, permissionCode: 'system:role:update', title: '编辑角色', type: 'button' },
          { id: 'system-role-delete', path: 'delete', order: 30, permissionCode: 'system:role:delete', title: '删除角色', type: 'button' },
          { id: 'system-role-authorize', path: 'authorize', order: 40, permissionCode: 'system:role:authorize', title: '角色授权', type: 'button' },
        ],
      },
      {
        id: 'system-menu',
        path: 'menu',
        icon: 'i-lucide-list-tree',
        order: 20,
        title: '菜单管理',
        type: 'menu',
        children: [
          { id: 'system-menu-create', path: 'create', order: 10, permissionCode: 'system:menu:create', title: '创建菜单', type: 'button' },
          { id: 'system-menu-update', path: 'update', order: 20, permissionCode: 'system:menu:update', title: '编辑菜单', type: 'button' },
          { id: 'system-menu-delete', path: 'delete', order: 30, permissionCode: 'system:menu:delete', title: '删除菜单', type: 'button' },
        ],
      },
      {
        id: 'system-user',
        path: 'user',
        icon: 'i-lucide-users-round',
        order: 30,
        title: '用户管理',
        type: 'menu',
        children: [
          { id: 'system-user-create', path: 'create', order: 10, permissionCode: 'system:user:create', title: '创建用户', type: 'button' },
          { id: 'system-user-update', path: 'update', order: 20, permissionCode: 'system:user:update', title: '编辑用户', type: 'button' },
          { id: 'system-user-delete', path: 'delete', order: 30, permissionCode: 'system:user:delete', title: '删除用户', type: 'button' },
        ],
      },
      {
        id: 'system-params',
        path: 'params',
        icon: 'i-lucide-braces',
        order: 40,
        title: '参数管理',
        type: 'menu',
        children: [
          { id: 'system-params-create', path: 'create', order: 10, permissionCode: 'system:param:create', title: '创建参数', type: 'button' },
          { id: 'system-params-update', path: 'update', order: 20, permissionCode: 'system:param:update', title: '编辑参数', type: 'button' },
          { id: 'system-params-delete', path: 'delete', order: 30, permissionCode: 'system:param:delete', title: '删除参数', type: 'button' },
        ],
      },
      {
        id: 'system-settings',
        path: 'settings',
        icon: 'i-lucide-sliders-horizontal',
        order: 50,
        title: '设置中心',
        type: 'directory',
        children: [
          {
            id: 'system-settings-level-three',
            path: 'level-three',
            description: '验证左侧导航的三级展开和折叠弹层效果',
            order: 10,
            title: '三级菜单示例',
            type: 'menu',
          },
          { id: 'system-settings-theme', path: 'theme', activePath: '/system/settings', hideInMenu: true, order: 30, tabPath: '/system/settings', title: '主题设置', type: 'menu' },
          {
            id: 'system-settings-notification',
            path: 'notification',
            activePath: '/system/settings',
            description: '邮件、站内信和安全提醒',
            hideInMenu: true,
            order: 40,
            tabPath: '/system/settings',
            title: '通知设置',
            type: 'menu',
          },
          { id: 'system-settings-account', path: 'account', description: '修改密码、绑定邮箱和手机号', order: 41, title: '账户设置', type: 'menu' },
        ],
      },
    ],
  },
  {
    id: 'tailwindcss-document',
    path: '/tailwindcss/document',
    parentId: 'group_links',
    iframeSrc: 'https://tailwindcss.com/docs',
    icon: 'i-lucide-book-open-text',
    keepAlive: true,
    order: 55,
    showActiveTabBorder: true,
    title: 'Tailwind CSS 文档',
    type: 'menu',
  },
  { id: 'docs-vite-plus', path: '/docs/vite-plus', parentId: 'group_links', externalLink: 'https://viteplus.dev/guide/', icon: 'i-lucide-book-open', order: 60, title: 'Vite+ 文档', type: 'menu' },
  { id: 'invalid-route-demo', path: '/not-exists', icon: 'i-lucide-circle-alert', order: 999, title: '无效菜单示例', type: 'menu' },
]

function flattenMenuTree(nodes: readonly MenuSeed[], parentId?: string): Array<InferInsertModel<typeof systemMenus>> {
  return nodes.flatMap((node) => {
    const { children, ...menu } = node
    const row: InferInsertModel<typeof systemMenus> = {
      ...menu,
      parentId: parentId ?? menu.parentId,
    }

    return [row, ...flattenMenuTree(children ?? [], node.id)]
  })
}

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

async function seedMenus() {
  try {
    console.info(`${logPrefix} 开始写入菜单...`)
    const menuRows = flattenMenuTree([...groupNodesSeed, ...menuTreeSeed])
    await db.insert(systemMenus).values(menuRows).onConflictDoNothing()
    console.info(`${logPrefix} 已创建 ${menuRows.length} 个菜单节点`)
    return menuRows
  } catch (error) {
    console.error(`${logPrefix} 写入菜单失败:`, error)
    throw error
  }
}

async function seedMenuRoles(menuRows: readonly InferInsertModel<typeof systemMenus>[], roles: { adminRole?: { id: string } | null }) {
  try {
    console.info(`${logPrefix} 开始写入菜单-角色关联...`)
    if (!roles.adminRole) {
      console.warn(`${logPrefix} 跳过菜单-角色关联：未找到 admin 角色`)
      return
    }

    const adminOnlyMenuIds = new Set([
      'access-menu-visible-403',
      'system',
      'system-role',
      'system-role-create',
      'system-role-update',
      'system-role-delete',
      'system-role-authorize',
      'system-menu',
      'system-menu-create',
      'system-menu-update',
      'system-menu-delete',
      'system-user',
      'system-user-create',
      'system-user-update',
      'system-user-delete',
      'system-params',
      'system-params-create',
      'system-params-update',
      'system-params-delete',
      'system-settings',
      'system-settings-level-three',
      'system-settings-theme',
      'system-settings-notification',
      'system-settings-account',
    ])
    const menuRoleRows = menuRows.filter(({ id }) => adminOnlyMenuIds.has(id)).map(({ id }) => ({ menuId: id, roleId: roles.adminRole!.id }))

    await db.insert(systemMenuRoles).values(menuRoleRows).onConflictDoNothing()
    console.info(`${logPrefix} 已创建 ${menuRoleRows.length} 条菜单-角色关联`)
  } catch (error) {
    console.error(`${logPrefix} 写入菜单-角色关联失败:`, error)
    throw error
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
      { v1: '/system/menus/tree', v2: 'GET' },
      { v1: '/system/menus', v2: 'POST' },
      { v1: '/system/menus/{id}', v2: 'PATCH' },
      { v1: '/system/menus/{id}', v2: 'DELETE' },
      { v1: '/system/roles', v2: 'GET' },
      { v1: '/system/roles', v2: 'POST' },
      { v1: '/system/roles/{id}', v2: 'DELETE' },
      { v1: '/system/roles/{id}', v2: 'GET' },
      { v1: '/system/roles/{id}', v2: 'PATCH' },
      { v1: '/system/roles/{id}/permissions', v2: 'GET' },
      { v1: '/system/roles/{id}/permissions', v2: 'PUT' },
      { v1: '/system/roles/{id}/menus', v2: 'GET' },
      { v1: '/system/roles/{id}/menus', v2: 'PUT' },
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

async function main() {
  // Track whether any seed data insertion failed / 标记整体 process 是否有 seed 失败
  let hasError = false
  console.info(`${logPrefix} 🚀 开始种子数据写入...`)
  // Each seed has its own try-catch, any failure does not affect the next / 每个 seed 单独 try-catch，任何失败不影响下一个
  let users: any = {}
  let roles: any = {}
  let menuRows: InferInsertModel<typeof systemMenus>[] = []
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
    menuRows = await seedMenus()
  } catch {
    hasError = true
  }
  try {
    await seedUserRoles(users, roles)
  } catch {
    hasError = true
  }
  try {
    await seedMenuRoles(menuRows, roles)
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
