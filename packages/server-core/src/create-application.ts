import type { OpenAPIHono } from '@hono/zod-openapi'
import type { ApiReferenceConfiguration } from '@scalar/hono-api-reference'
import type { RouterRoute } from 'hono/types'
import type { AppConfig, MiddlewareWithExcept, OpenAPIConfig, RouteModule, TierConfig, TierMiddleware } from './config.ts'
import type { BaseBindings } from './types.ts'
import { Scalar as scalarHonoApiReference } from '@scalar/hono-api-reference'
import { except } from 'hono/combine'
import { baseRoutePath, matchedRoutes } from 'hono/route'
import { mergePath } from 'hono/utils/url'
import { createRouter } from './router.ts'

// Hono's route schema generic is invariant; composition intentionally erases it at this boundary / Hono 的路由 Schema 泛型是不变的，组合时在此边界有意擦除它
// oxlint-disable-next-line typescript/no-explicit-any
type AnyRouter = OpenAPIHono<any>
type MiddlewareModule = { default: TierMiddleware[] }

export type ApplicationRuntime<TEnv> = {
  env: TEnv
  version: string
  routes: Record<string, RouteModule>
  middlewares: Record<string, MiddlewareModule>
  createApp: () => OpenAPIHono<BaseBindings>
}

function resolveTierBasePath<TEnv>(tier: TierConfig, config: AppConfig<TEnv>): string {
  if (tier.basePath) return tier.basePath
  const prefix = config.prefix ?? '/api'
  const version = config.version ? `/${config.version}` : ''
  if (tier.name === 'public') return `${prefix}${version}`
  return `${prefix}${version}/${tier.name}`
}

function resolveTierRoutes(tier: TierConfig, allRoutes: Record<string, RouteModule>): Record<string, RouteModule> {
  if (tier.routes) return tier.routes
  const directoryName = tier.routeDir ?? tier.name
  return Object.fromEntries(
    Object.entries(allRoutes).filter(([path]) => {
      const match = path.match(/\/routes\/([^/]+)\//)
      return match?.[1] === directoryName
    }),
  )
}

function resolveTierMiddlewares(tier: TierConfig, allMiddlewares: Record<string, MiddlewareModule>): TierMiddleware[] {
  if (tier.middlewares) return tier.middlewares
  const directoryName = tier.routeDir ?? tier.name
  const key = Object.keys(allMiddlewares).find((path) => path.includes(`/routes/${directoryName}/_middleware.ts`))
  return key ? allMiddlewares[key]!.default : []
}

function isMiddlewareWithExcept(middleware: TierMiddleware): middleware is MiddlewareWithExcept {
  return typeof middleware === 'object' && 'handler' in middleware && 'except' in middleware
}

function getTierRouteKey({ method, path }: RouterRoute, prefix: string): string {
  if (path !== prefix && !path.startsWith(`${prefix}/`)) return ''
  return `${method} ${path.slice(prefix.length)}`
}

function resolveEnabled<TEnv>(enabled: OpenAPIConfig<TEnv>['enabled'], env: TEnv): boolean {
  if (typeof enabled === 'function') return enabled(env)
  if (typeof enabled === 'boolean') return enabled
  return true
}

function configureAppDocument<TEnv>(router: AnyRouter, tier: TierConfig, config: AppConfig<TEnv>, documentEndpoint: string, version: string) {
  const documentConfig = {
    openapi: config.openapi?.version ?? '3.1.0',
    info: { version, title: tier.title },
  }

  if (tier.token) {
    const securityName = `${tier.name}Bearer`
    router.openAPIRegistry.registerComponent('securitySchemes', securityName, {
      type: 'http',
      scheme: 'bearer',
    })
    router.doc31(documentEndpoint, {
      ...documentConfig,
      security: [{ [securityName]: [] }],
    })
    return
  }

  router.doc31(documentEndpoint, documentConfig)
}

type TierApp = {
  tierApp: AnyRouter
  tier: TierConfig
  basePath: string
}

function configureScalarUi<TEnv>(app: AnyRouter, tierApps: TierApp[], config: AppConfig<TEnv>, documentEndpoint: string) {
  const scalarConfig = config.openapi?.scalar ?? {}
  app.get(
    '/',
    scalarHonoApiReference({
      ...(scalarConfig as Partial<ApiReferenceConfiguration>),
      sources: tierApps.map(({ tier, basePath }, index) => ({
        title: tier.title,
        slug: tier.name,
        url: `${basePath}${documentEndpoint}`,
        default: index === 0,
      })),
      authentication: {
        securitySchemes: Object.fromEntries(tierApps.filter(({ tier }) => tier.token).map(({ tier }) => [`${tier.name}Bearer`, { token: tier.token! }])),
      },
    }),
  )
}

export async function createApplication<TEnv>(config: AppConfig<TEnv>, runtime: ApplicationRuntime<TEnv>): Promise<OpenAPIHono<BaseBindings>> {
  const app = runtime.createApp()
  const openapiEnabled = resolveEnabled(config.openapi?.enabled, runtime.env)
  const documentEndpoint = config.openapi?.docEndpoint ?? '/doc'
  const tierApps: TierApp[] = []

  for (const tier of config.tiers) {
    const basePath = resolveTierBasePath(tier, config)
    const tierApp = createRouter().basePath(basePath)
    const tierPrefix = mergePath('/', basePath).replace(/\/$/, '')
    const routeKeys = new Set<string>()

    if (openapiEnabled) {
      configureAppDocument(tierApp, tier, config, documentEndpoint, runtime.version)
    }

    tierApp.use('/*', async (context, next) => {
      context.set('tierBasePath', basePath)
      await next()
    })

    for (const middleware of resolveTierMiddlewares(tier, runtime.middlewares)) {
      const handler = isMiddlewareWithExcept(middleware) ? except(middleware.except, middleware.handler) : middleware
      tierApp.use('/*', (context, next) => {
        // Let the root app handle missing routes while protecting matched tier routes with tier-relative patterns, preserving authentication across mounts / 未匹配路由由根应用处理；已匹配的 tier 路由使用相对路径保护，确保后续挂载保留认证
        const mountedPrefix = baseRoutePath(context).replace(/\/$/, '')
        if (!matchedRoutes(context).some((route) => routeKeys.has(getTierRouteKey(route, mountedPrefix)))) return next()
        return handler(context, next)
      })
    }

    for (const module of Object.values(resolveTierRoutes(tier, runtime.routes))) {
      const firstRoute = tierApp.routes.length
      tierApp.route('/', module.default)
      for (let index = firstRoute; index < tierApp.routes.length; index++) routeKeys.add(getTierRouteKey(tierApp.routes[index]!, tierPrefix))
    }

    tierApps.push({ tierApp, tier, basePath })
  }

  if (openapiEnabled) {
    configureScalarUi(app, tierApps, config, documentEndpoint)
  }

  for (const { tierApp } of tierApps) {
    app.route('/', tierApp)
  }

  return app
}
