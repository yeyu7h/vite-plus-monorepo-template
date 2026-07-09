import type { AdminBackendMenu } from '@monorepo-admin-core/types'

export interface AdminLoginParams {
  password: string
  username: string
}

export interface AdminLoginResult {
  accessToken: string
}

export interface AdminUserInfo {
  avatar?: string
  homePath: string
  realName: string
  roles: string[]
  userId: string
  username: string
}

const mockUsers: Record<string, AdminUserInfo & { password: string }> = {
  admin: {
    avatar: 'https://avatar.vercel.sh/admin',
    homePath: '/dashboard/workbench',
    password: 'admin123',
    realName: 'Admin User',
    roles: ['admin'],
    userId: '1',
    username: 'admin',
  },
  user: {
    avatar: 'https://avatar.vercel.sh/user',
    homePath: '/dashboard/workbench',
    password: 'user123',
    realName: 'Normal User',
    roles: ['user'],
    userId: '2',
    username: 'user',
  },
}

const backendMenus: AdminBackendMenu[] = [
  {
    id: 'dashboard',
    path: '/dashboard',
    meta: {
      icon: 'i-lucide-layout-dashboard',
      menuGroup: { id: 'workspace', label: '工作台', order: 10 },
      order: 10,
      title: 'Dashboard',
    },
    children: [
      {
        id: 'dashboard-workbench',
        path: '/dashboard/workbench',
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
      menuGroup: { id: 'workspace', label: '工作台', order: 10 },
      order: 20,
      title: '报表',
    },
    children: [
      {
        id: 'reports-sales',
        path: '/reports/sales',
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
      menuGroup: { id: 'ops', label: '运维', order: 20 },
      order: 30,
      title: '监控',
    },
    children: [
      {
        id: 'monitor-jobs',
        path: '/monitor/jobs',
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
      menuGroup: { id: 'workspace', label: '工作台', order: 10 },
      order: 40,
      title: '用户列表',
    },
  },
  {
    id: 'map',
    path: '/map',
    meta: {
      icon: 'i-lucide-map',
      menuGroup: { id: 'ops', label: '运维', order: 20 },
      order: 35,
      showActiveTabBorder: true,
      title: '地图',
    },
  },
  {
    id: 'access',
    path: '/access',
    meta: {
      icon: 'i-lucide-key-round',
      menuGroup: { id: 'workspace', label: '工作台', order: 10 },
      order: 45,
      title: '权限演示',
    },
    children: [
      {
        id: 'access-menu-visible-403',
        path: '/access/menu-visible-403',
        meta: {
          authority: ['admin'],
          icon: 'i-lucide-eye-off',
          menuVisibleWithForbidden: true,
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
      menuGroup: { id: 'system', label: '系统管理', order: 30 },
      order: 50,
      title: '系统',
    },
    children: [
      {
        id: 'system-role',
        path: '/system/role',
        meta: {
          authority: ['admin'],
          icon: 'i-lucide-shield',
          order: 10,
          title: '角色管理',
        },
      },
      {
        id: 'system-settings',
        path: '/system/settings',
        meta: {
          authority: ['admin'],
          icon: 'i-lucide-sliders-horizontal',
          order: 20,
          title: '设置中心',
        },
      },
      {
        id: 'system-settings-theme',
        path: '/system/settings/theme',
        meta: {
          activePath: '/system/settings',
          authority: ['admin'],
          hideInMenu: true,
          hideInTab: true,
          order: 30,
          title: '主题设置',
        },
      },
      {
        id: 'system-settings-notification',
        path: '/system/settings/notification',
        meta: {
          activePath: '/system/settings',
          authority: ['admin'],
          hideInMenu: true,
          hideInTab: true,
          order: 40,
          title: '通知设置',
        },
      },
    ],
  },
  {
    id: 'docs-vite-plus',
    path: '/docs/vite-plus',
    meta: {
      externalLink: 'https://viteplus.dev/guide/',
      icon: 'i-lucide-book-open',
      menuGroup: { id: 'links', label: '链接', order: 40 },
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

  return { accessToken: `mock-token:${user.username}` }
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
  return backendMenus
}
