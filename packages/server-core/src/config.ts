import type { OpenAPIHono } from '@hono/zod-openapi'
import type { ApiReferenceConfiguration } from '@scalar/hono-api-reference'
import type { Context, MiddlewareHandler } from 'hono'

export type MiddlewareWithExcept = {
  handler: MiddlewareHandler
  except: (context: Context) => boolean
}

export type TierMiddleware = MiddlewareHandler | MiddlewareWithExcept

export type RouteModule = {
  // oxlint-disable-next-line typescript/no-explicit-any
  default: OpenAPIHono<any>
}

export type TierConfig = {
  name: string
  title: string
  token?: string
  basePath?: string
  routeDir?: string
  routes?: Record<string, RouteModule>
  middlewares?: TierMiddleware[]
}

export type OpenAPIConfig<TEnv> = {
  enabled?: boolean | ((env: TEnv) => boolean)
  version?: string
  docEndpoint?: string
  scalar?: Partial<ApiReferenceConfiguration>
}

export type AppConfig<TEnv = unknown> = {
  prefix?: string
  version?: string
  openapi?: OpenAPIConfig<TEnv>
  tiers: TierConfig[]
}

export function defineConfig<TEnv = unknown>(config: AppConfig<TEnv>): AppConfig<TEnv> {
  return config
}

export function defineMiddleware(middlewares: TierMiddleware[]): TierMiddleware[] {
  return middlewares
}
