export type AdminMenuAuthority = string[]

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
