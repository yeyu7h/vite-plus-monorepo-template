import type * as routes from './menu-groups.routes'
import type { AdminRouteHandler } from '@monorepo/server-core'

type RouteTypes = { [K in keyof typeof routes]: (typeof routes)[K] }

export type MenuGroupRouteHandlerType<T extends keyof RouteTypes> = AdminRouteHandler<RouteTypes[T]>
