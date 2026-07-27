import type * as routes from './users.routes'
import type { ClientRouteHandler } from '@monorepo/server-core'

type RouteTypes = {
  [K in keyof typeof routes]: (typeof routes)[K]
}

export type ClientUsersRouteHandlerType<T extends keyof RouteTypes> = ClientRouteHandler<RouteTypes[T]>
