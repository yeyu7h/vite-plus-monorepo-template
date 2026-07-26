import type { AdminBackendMenu } from '@monorepo-admin-core/types'

export interface AdminLoginParams {
  password: string
  username: string
}

export interface AdminLoginResult {
  access_token: string
}

export interface AdminUserInfo {
  avatar?: string
  home_path: string
  real_name: string
  roles: string[]
  user_id: string
  username: string
}

type AdminBackendMenuAuthorityDto = string[]

interface AdminBackendMenuImageIconDto {
  dark?: string
  light: string
}

type AdminBackendMenuIconDto = AdminBackendMenuImageIconDto | string

interface AdminBackendMenuGroupMetaDto {
  id?: string
  label: string
  order?: number
}

interface AdminBackendMenuMetaDto {
  active_path?: string
  authority?: AdminBackendMenuAuthorityDto
  description?: string
  external_link?: string
  hide_in_breadcrumb?: boolean
  hide_in_menu?: boolean
  hide_in_tab?: boolean
  icon?: AdminBackendMenuIconDto
  iframe_src?: string
  ignore_access?: boolean
  menu_group?: AdminBackendMenuGroupMetaDto | string
  menu_visible_with_forbidden?: boolean
  order?: number
  show_active_tab_border?: boolean
  tab_path?: string
  title: string
}

interface AdminBackendMenuDto {
  children?: AdminBackendMenuDto[]
  id: string
  meta: AdminBackendMenuMetaDto
  path: string
}

const mockUsers: Record<string, AdminUserInfo & { password: string }> = {
  admin: {
    avatar: 'https://avatar.vercel.sh/admin',
    home_path: '/dashboard/workbench',
    password: 'admin123',
    real_name: 'Admin User',
    roles: ['admin'],
    user_id: '1',
    username: 'admin',
  },
  user: {
    avatar: 'https://avatar.vercel.sh/user',
    home_path: '/dashboard/workbench',
    password: 'user123',
    real_name: 'Normal User',
    roles: ['user'],
    user_id: '2',
    username: 'user',
  },
}

const backendMenus: AdminBackendMenuDto[] = [
  {
    id: 'dashboard',
    path: '/dashboard',
    meta: {
      icon: 'i-lucide-layout-dashboard',
      menu_group: { id: 'workspace', label: '工作台', order: 10 },
      order: 10,
      title: 'Dashboard',
    },
    children: [
      {
        id: 'dashboard-workbench',
        path: 'workbench',
        meta: {
          icon: 'i-lucide-monitor',
          order: 10,
          title: '工作台',
        },
      },
    ],
  },
  {
    id: 'reports',
    path: '/reports',
    meta: {
      icon: 'i-lucide-chart-column',
      menu_group: { id: 'workspace', label: '工作台', order: 10 },
      order: 20,
      title: '报表',
    },
    children: [
      {
        id: 'reports-sales',
        path: 'sales',
        meta: {
          icon: 'i-lucide-chart-no-axes-combined',
          order: 10,
          title: '销售报表',
        },
      },
    ],
  },
  {
    id: 'monitor',
    path: '/monitor',
    meta: {
      icon: {
        dark: 'https://raw.githubusercontent.com/Koolson/Qure/refs/heads/master/IconSet/Color/Apple.png',
        light: 'https://raw.githubusercontent.com/Koolson/Qure/refs/heads/master/IconSet/Color/Apple.png',
      },
      menu_group: { id: 'ops', label: '运维', order: 20 },
      order: 30,
      title: '监控',
    },
    children: [
      {
        id: 'monitor-jobs',
        path: 'jobs',
        meta: {
          icon: {
            dark: 'https://raw.githubusercontent.com/Koolson/Qure/refs/heads/master/IconSet/Color/App_Store.png',
            light: 'https://raw.githubusercontent.com/Koolson/Qure/refs/heads/master/IconSet/Color/App_Store.png',
          },
          order: 10,
          title: '任务监控',
        },
      },
    ],
  },
  {
    id: 'user',
    path: '/user/',
    meta: {
      icon: 'i-lucide-users',
      menu_group: { id: 'workspace', label: '工作台', order: 10 },
      order: 40,
      title: '用户列表',
    },
  },
  {
    id: 'map',
    path: '/map',
    meta: {
      icon: 'i-lucide-map',
      menu_group: { id: 'ops', label: '运维', order: 20 },
      order: 35,
      show_active_tab_border: true,
      title: '地图',
    },
  },
  {
    id: 'access',
    path: '/access',
    meta: {
      icon: 'i-lucide-key-round',
      menu_group: { id: 'workspace', label: '工作台', order: 10 },
      order: 45,
      title: '权限演示',
    },
    children: [
      {
        id: 'access-menu-visible-403',
        path: 'menu-visible-403',
        meta: {
          authority: ['admin'],
          icon: 'i-lucide-eye-off',
          menu_visible_with_forbidden: true,
          order: 10,
          title: '可见但无权限',
        },
      },
    ],
  },
  {
    id: 'system',
    path: '/system',
    meta: {
      authority: ['admin'],
      icon: 'i-lucide-settings',
      menu_group: { id: 'system', label: '系统管理', order: 30 },
      order: 50,
      title: '系统',
    },
    children: [
      {
        id: 'system-role',
        path: 'role',
        meta: {
          authority: ['admin'],
          icon: 'i-lucide-shield',
          order: 10,
          title: '角色管理',
        },
      },
      {
        id: 'system-settings',
        path: 'settings',
        meta: {
          authority: ['admin'],
          icon: 'i-lucide-sliders-horizontal',
          order: 20,
          title: '设置中心',
        },
        children: [
          {
            id: 'system-settings-theme',
            path: 'theme',
            meta: {
              active_path: '/system/settings',
              authority: ['admin'],
              hide_in_menu: true,
              order: 30,
              tab_path: '/system/settings',
              title: '主题设置',
            },
          },
          {
            id: 'system-settings-notification',
            path: 'notification',
            meta: {
              active_path: '/system/settings',
              authority: ['admin'],
              description: '邮件、站内信和安全提醒',
              hide_in_menu: true,
              order: 40,
              tab_path: '/system/settings',
              title: '通知设置',
            },
          },
          {
            id: 'system-settings-account',
            path: 'account',
            meta: {
              // active_path: '/system/settings',
              authority: ['admin'],
              description: '修改密码、绑定邮箱和手机号',
              // hide_in_menu: true,
              order: 41,
              // tab_path: '/system/settings',
              title: '账户设置',
            },
          },
        ],
      },
    ],
  },
  {
    id: 'tailwindcss-document',
    path: '/tailwindcss/document',
    meta: {
      iframe_src: 'https://tailwindcss.com/docs',
      icon: 'i-lucide-book-open-text',
      menu_group: { id: 'links', label: '链接', order: 40 },
      order: 55,
      title: 'Tailwind CSS 文档',
      show_active_tab_border: true,
    },
  },
  {
    id: 'docs-vite-plus',
    path: '/docs/vite-plus',
    meta: {
      external_link: 'https://viteplus.dev/guide/',
      icon: 'i-lucide-book-open',
      menu_group: { id: 'links', label: '链接', order: 40 },
      order: 60,
      title: 'Vite+ 文档',
    },
  },
  {
    id: 'invalid-route-demo',
    path: '/not-exists',
    meta: {
      icon: 'i-lucide-circle-alert',
      order: 999,
      title: '无效菜单示例',
    },
  },
]

export async function loginApi(params: AdminLoginParams): Promise<AdminLoginResult> {
  const user = mockUsers[params.username]

  if (!user || user.password !== params.password) {
    throw new Error('用户名或密码错误')
  }

  return { access_token: `mock-token:${user.username}` }
}

export async function getUserInfoApi(accessToken: string): Promise<AdminUserInfo> {
  const username = accessToken.replace('mock-token:', '')
  const user = mockUsers[username]

  if (!user) {
    throw new Error('登录状态无效')
  }

  const { password: _password, ...userInfo } = user
  return userInfo
}

export async function getBackendMenusApi(): Promise<AdminBackendMenu[]> {
  return snakeToCamelDeep<AdminBackendMenu[]>(backendMenus)
}

function snakeToCamel(value: string) {
  return value.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase())
}

function snakeToCamelDeep<T>(value: unknown): T {
  if (Array.isArray(value)) {
    return value.map((item) => snakeToCamelDeep(item)) as T
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [snakeToCamel(key), snakeToCamelDeep(item)])) as T
  }

  return value as T
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === '[object Object]'
}
