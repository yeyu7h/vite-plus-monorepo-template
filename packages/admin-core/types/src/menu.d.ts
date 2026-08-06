import type { AdminContentMode } from './content'

export type AdminMenuAuthority = string[]

/** 后端菜单节点类型；按钮节点只用于权限码，不会生成前端路由。 */
export type AdminMenuType = 'directory' | 'menu' | 'button'

export interface AdminMenuImageIcon {
  /** 暗色主题下展示的图标地址 */
  dark?: string
  /** 亮色主题下展示的图标地址 */
  light: string
}

export type AdminMenuIcon = AdminMenuImageIcon | string

export interface AdminMenuItem {
  /** 当前菜单项是否处于激活态 */
  active?: boolean
  /** 菜单项用于激活匹配的路径 */
  activePath?: string
  /** 当前菜单项要求的权限标识 */
  authority?: AdminMenuAuthority
  /** 子级菜单项 */
  children?: AdminMenuItem[]
  /** 菜单项跳转的外部链接地址 */
  externalLink?: string
  /** 菜单项展示的图标 */
  icon?: AdminMenuIcon
  /** 菜单项在导航树中的稳定标识 */
  id: string
  /** 菜单项排序权重 */
  order?: number
  /** 菜单项实际跳转路径 */
  path: string
  /** 菜单项显示标题 */
  title: string
}

export interface AdminMenuGroupMeta {
  /** 菜单分组的稳定标识 */
  id?: string
  /** 菜单分组显示标题 */
  label: string
  /** 菜单分组排序权重 */
  order?: number
}

export interface AdminMenuGroup {
  /** 当前分组下的菜单树 */
  children: AdminMenuItem[]
  /** 菜单分组的稳定标识 */
  id: string
  /** 菜单分组显示标题 */
  label?: string
  /** 菜单分组排序权重 */
  order?: number
}

export interface AdminBackendMenuMeta {
  /** 指定当前路由高亮时对应的菜单路径 */
  activePath?: string
  /** 声明访问该菜单和路由项所需的权限标识 */
  authority?: AdminMenuAuthority
  /** 控制页面使用普通内容布局或固定视口全屏布局 */
  contentMode?: AdminContentMode
  /** 页面或导航项的辅助说明 */
  description?: string
  /** 将菜单跳转目标替换为外部链接地址 */
  externalLink?: string
  /** 在自动生成的面包屑中隐藏该路由 */
  hideInBreadcrumb?: boolean
  /** 在自动生成的菜单中隐藏该路由 */
  hideInMenu?: boolean
  /** 禁止为该路由创建标签页 */
  hideInTab?: boolean
  /** 声明当前路由不进入登录权限拦截 */
  ignoreAccess?: boolean
  /** 菜单、面包屑和标签页图标 */
  icon?: AdminMenuIcon
  /** 使用 iframe 内嵌展示的页面地址 */
  iframeSrc?: string
  /** 切换标签页时保留当前页面或 iframe 的运行状态 */
  keepAlive?: boolean
  /** 指定该菜单所属分组 */
  menuGroup?: AdminMenuGroupMeta | string
  /** 菜单可见 但权限不命中时访问页面渲染 403 */
  menuVisibleWithForbidden?: boolean
  /** 菜单排序权重 */
  order?: number
  /** 控制激活状态下的标签页是否显示下边框 默认隐藏 */
  showActiveTabBorder?: boolean
  /** 指定当前路由复用的标签页路径 */
  tabPath?: string
  /** 菜单显示标题 */
  title: string
}

export interface AdminBackendMenu {
  /** 后端菜单稳定标识 */
  id: string
  /** 后端菜单节点类型 */
  type?: AdminMenuType
  /** 子级菜单 */
  children?: AdminBackendMenu[]
  /** 菜单元数据 */
  meta: AdminBackendMenuMeta
  /** 顶层使用绝对路径 子级可使用相对父级的路径 外链菜单除外 */
  path: string
}

/** 管理端初始化权限所需的后端数据。 */
export interface AdminAccessPayload {
  menus: AdminBackendMenu[]
  permissionCodes: string[]
}
