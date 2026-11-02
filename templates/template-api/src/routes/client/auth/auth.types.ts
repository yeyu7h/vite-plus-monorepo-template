import type * as routes from './auth.routes'
import type { ClientRouteHandler } from '@monorepo/server-core'

export type ClientAuthHandler<T extends keyof typeof routes> = ClientRouteHandler<(typeof routes)[T]>
