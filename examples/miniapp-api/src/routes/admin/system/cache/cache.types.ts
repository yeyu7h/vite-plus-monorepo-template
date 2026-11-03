import type { AdminRouteHandler } from '@monorepo/server-core'
import type * as routes from './cache.routes'

export type CacheRouteHandlerType<T extends keyof typeof routes> = AdminRouteHandler<(typeof routes)[T]>
