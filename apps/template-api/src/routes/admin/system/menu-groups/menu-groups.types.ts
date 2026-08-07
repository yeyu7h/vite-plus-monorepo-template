import type { AdminRouteHandler } from '@monorepo/server-core'
import type * as routes from './menu-groups.routes'

type RouteTypes = { [K in keyof typeof routes]: (typeof routes)[K] }

export type MenuGroupsRouteHandler<T extends keyof RouteTypes> = AdminRouteHandler<RouteTypes[T]>
