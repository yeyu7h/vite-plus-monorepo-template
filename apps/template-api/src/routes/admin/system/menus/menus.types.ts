import type * as routes from './menus.routes'
import type { AdminRouteHandler } from '@monorepo/server-core'

type RouteTypes = { [K in keyof typeof routes]: (typeof routes)[K] }

export type MenuRouteHandlerType<T extends keyof RouteTypes> = AdminRouteHandler<RouteTypes[T]>
