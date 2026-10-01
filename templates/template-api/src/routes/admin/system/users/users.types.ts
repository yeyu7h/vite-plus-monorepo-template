import type * as routes from './users.routes'
import type { AdminRouteHandler } from '@monorepo/server-core'

type RouteTypes = {
  [K in keyof typeof routes]: (typeof routes)[K]
}

export type SystemUsersRouteHandlerType<T extends keyof RouteTypes> = AdminRouteHandler<RouteTypes[T]>
