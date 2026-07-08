import type { AdminRouteMeta } from '@monorepo-admin-core/types'

/**
 * 判断给定路径是否是外部链接
 * @param path 待判断的路径
 */
export function isExternalAdminPath(path: string) {
  return /^https?:\/\//.test(path)
}

/**
 * 规范化导航层使用的路径 移除 query/hash 并统一前导 尾随斜杠
 * @param path 原始路径
 */
export function normalizeAdminNavigationPath(path: string) {
  if (!path) return '/'
  if (isExternalAdminPath(path)) return path

  const pathname = path.split(/[?#]/)[0] ?? '/'
  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`

  return normalized.length > 1 ? normalized.replace(/\/+$/, '') : normalized
}

/**
 * 将路径片段转换成可读标题 作为缺失 meta.title 时的回退文案
 * @param segment 路径片段
 */
export function formatAdminNavigationTitle(segment: string) {
  return segment
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

/**
 * 生成导航项可点击路径
 * @param path 导航项原始路径
 * @param meta 路由元信息
 * @param currentPath 当前所在路径
 */
export function createAdminNavigationItemPath(path: string, meta: AdminRouteMeta | undefined, currentPath: string) {
  const normalizedPath = normalizeAdminNavigationPath(path)

  if (normalizedPath === currentPath) return undefined
  if (meta?.externalLink) return undefined

  return normalizedPath
}
