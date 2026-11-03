type AdminRouteDefinition = {
  method: string | string[]
  path: string
  summary?: string
  tags?: string[]
}

const adminRouteModules = import.meta.glob<Record<string, unknown>>('/src/routes/admin/**/*.routes.ts', { eager: true })

function isAdminRouteDefinition(value: unknown): value is AdminRouteDefinition {
  if (typeof value !== 'object' || value === null) return false
  const route = value as Partial<AdminRouteDefinition>
  return typeof route.path === 'string' && (typeof route.method === 'string' || (Array.isArray(route.method) && route.method.every((method) => typeof method === 'string')))
}

export function getAdminPermissionCatalog() {
  const catalog = Object.values(adminRouteModules)
    .flatMap((module) => Object.values(module))
    .filter(isAdminRouteDefinition)
    .filter(({ path }) => !path.startsWith('/auth'))
    .flatMap((route) =>
      (Array.isArray(route.method) ? route.method : [route.method]).map((method) => ({
        resource: route.path,
        action: method.toUpperCase(),
        summary: route.summary ?? route.path,
        group: route.tags?.[0] ?? '其他',
      })),
    )

  return [...new Map(catalog.map((item) => [`${item.resource}\u0000${item.action}`, item])).values()].sort((a, b) => `${a.resource}\u0000${a.action}`.localeCompare(`${b.resource}\u0000${b.action}`))
}
