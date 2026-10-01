import type { AdminRouteHandler } from '@monorepo/server-core'
import type * as routes from './menus.routes'

type RouteTypes = { [K in keyof typeof routes]: (typeof routes)[K] }

export type MenusRouteHandler<T extends keyof RouteTypes> = AdminRouteHandler<RouteTypes[T]>
