import type { MiddlewareHandler } from 'hono'
import { createRoute, z } from '@hono/zod-openapi'
import { describe, expect, it, vi } from 'vite-plus/test'
import { createApplication } from './create-application.ts'
import { createRouter } from './router.ts'

async function createTestApplication({ basePath = '/', customErrorHandler = false } = {}) {
  const authenticate = vi.fn<MiddlewareHandler>(async (c, next) => {
    if (c.req.header('Authorization') !== 'Bearer valid') return c.json({ message: '需要登录' }, 401)
    return next()
  })
  const rootMiddleware = vi.fn<MiddlewareHandler>(async (_c, next) => next())
  const routeMiddleware = vi.fn<MiddlewareHandler>(async (_c, next) => next())
  const publicRoutes = createRouter()
  publicRoutes.get('/health', (c) => c.text('healthy'))
  const clientRoutes = createRouter()
  clientRoutes
    .post('/auth/login', (c) => c.text('login'))
    .get('/items/:id', (c) => c.text(c.req.param('id')))
    .get('/numbers/:id{[0-9]+}', (c) => c.text(c.req.param('id')))
    .all('/fallback/*', (c) => c.text('fallback'))
  clientRoutes.openapi(
    createRoute({
      method: 'get',
      path: '/openapi/{id}',
      middleware: [routeMiddleware] as const,
      request: { params: z.object({ id: z.string() }) },
      responses: { 200: { description: 'OK', content: { 'text/plain': { schema: z.string() } } } },
    }),
    (c) => c.text(c.req.valid('param').id),
  )
  const adminRoutes = createRouter()
  adminRoutes.get('/users/:id', (c) => c.text(c.req.param('id')))

  const app = await createApplication(
    {
      openapi: { enabled: false },
      tiers: [
        { name: 'public', title: 'Public', routes: { public: { default: publicRoutes } } },
        {
          name: 'client',
          title: 'Client',
          routes: { client: { default: clientRoutes } },
          middlewares: [{ handler: authenticate, except: (c) => c.req.method === 'POST' && c.req.path === `${c.get('tierBasePath')}/auth/login` }],
        },
        { name: 'admin', title: 'Admin', routes: { admin: { default: adminRoutes } }, middlewares: [authenticate] },
      ],
    },
    {
      env: {},
      version: '1.0.0',
      routes: {},
      middlewares: {},
      createApp: () => {
        const root = createRouter().basePath(basePath)
        root.use('*', rootMiddleware)
        root.on('POST', '*', async (_c, next) => next())
        root.notFound((c) => c.json({ message: `未找到 - ${c.req.path}` }, 404))
        if (customErrorHandler) root.onError((_error, c) => c.text('Root error', 500))
        return root
      },
    },
  )

  return { app, authenticate, rootMiddleware, routeMiddleware }
}

describe('application route matching and tier authentication', () => {
  it.each([
    ['GET', '/api/client/auth/missing'],
    ['POST', '/api/client/auth/missing'],
    ['GET', '/api/client/auth/login'],
    ['POST', '/api/client/items/123'],
    ['GET', '/api/client/items/123/details'],
    ['GET', '/api/client/numbers/abc'],
    ['GET', '/api/admin/missing'],
  ])('returns the app 404 for an unregistered %s %s', async (method, path) => {
    const { app, authenticate, rootMiddleware } = await createTestApplication()
    const response = await app.request(path, { method })

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ message: `未找到 - ${path}` })
    expect(authenticate).not.toHaveBeenCalled()
    expect(rootMiddleware).toHaveBeenCalledOnce()
  })

  it.each(['/api/client/items/123', '/api/client/items/123/', '/api/client/numbers/42', '/api/admin/users/123', '/api/client/fallback/nested', '/api/client/openapi/123'])(
    'authenticates a registered route: %s',
    async (path) => {
      const { app, authenticate } = await createTestApplication()

      expect((await app.request(path)).status).toBe(401)
      expect(authenticate).toHaveBeenCalledOnce()
      expect((await app.request(path, { headers: { Authorization: 'Bearer valid' } })).status).toBe(200)
    },
  )

  it('preserves public routes and exact authentication exemptions', async () => {
    const { app, authenticate } = await createTestApplication()

    expect((await app.request('/api/health')).status).toBe(200)
    expect((await app.request('/api/client/auth/login', { method: 'POST' })).status).toBe(200)
    expect(authenticate).not.toHaveBeenCalled()
  })

  it('authenticates OpenAPI routes before running their route middleware', async () => {
    const { app, routeMiddleware } = await createTestApplication()

    expect((await app.request('/api/client/openapi/123')).status).toBe(401)
    expect(routeMiddleware).not.toHaveBeenCalled()
    expect((await app.request('/api/client/openapi/123', { headers: { Authorization: 'Bearer valid' } })).status).toBe(200)
    expect(routeMiddleware).toHaveBeenCalledOnce()
  })

  it('uses GET route matching for HEAD requests', async () => {
    const { app } = await createTestApplication()

    expect((await app.request('/api/client/items/123', { method: 'HEAD' })).status).toBe(401)
    expect((await app.request('/api/client/items/123', { method: 'HEAD', headers: { Authorization: 'Bearer valid' } })).status).toBe(200)
    expect((await app.request('/api/client/missing', { method: 'HEAD' })).status).toBe(404)
  })

  it.each([
    { name: 'a root base path', basePath: '/root', mountPaths: [], requestPrefix: '/root', customErrorHandler: false },
    { name: 'a parent prefix', basePath: '/', mountPaths: ['/outer'], requestPrefix: '/outer', customErrorHandler: false },
    { name: 'nested prefixes', basePath: '/root', mountPaths: ['/inner', '/outer'], requestPrefix: '/outer/inner/root', customErrorHandler: false },
    { name: 'a parameterized prefix', basePath: '/', mountPaths: ['/tenants/:tenantId'], requestPrefix: '/tenants/acme', customErrorHandler: false },
    { name: 'nested error handlers', basePath: '/root', mountPaths: ['/inner', '/outer'], requestPrefix: '/outer/inner/root', customErrorHandler: true },
  ])('preserves tier authentication and missing routes with $name', async ({ basePath, mountPaths, requestPrefix, customErrorHandler }) => {
    const { app, authenticate, routeMiddleware } = await createTestApplication({ basePath, customErrorHandler })
    let mounted = app
    for (const prefix of mountPaths) {
      const parent = createRouter()
      if (customErrorHandler) parent.onError((_error, c) => c.text('Parent error', 500))
      mounted = parent.route(prefix, mounted)
    }

    const path = `${requestPrefix}/api/client/openapi/123`
    expect((await mounted.request(path)).status).toBe(401)
    expect(authenticate).toHaveBeenCalledOnce()
    expect(routeMiddleware).not.toHaveBeenCalled()

    const response = await mounted.request(path, { headers: { Authorization: 'Bearer valid' } })
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('123')
    expect(routeMiddleware).toHaveBeenCalledOnce()
    expect((await mounted.request(`${requestPrefix}/api/client/items/123`, { method: 'HEAD' })).status).toBe(401)

    authenticate.mockClear()
    expect((await mounted.request(`${requestPrefix}/api/client/missing`)).status).toBe(404)
    expect((await mounted.request(`${requestPrefix}/api/client/items/123`, { method: 'POST' })).status).toBe(404)
    expect(authenticate).not.toHaveBeenCalled()
  })
})
