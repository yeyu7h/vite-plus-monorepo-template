import type { AdminBindings } from '@monorepo/server-core'
import { OpenAPIHono } from '@hono/zod-openapi'
import { pinoLogger } from 'hono-pino'

import { requestId } from 'hono/request-id'

import { notFound, onError } from '@/lib/core/stoker/middlewares'
import { defaultHook } from '@monorepo/server-core'
import logger from '@/lib/services/logger'

function createRouter() {
  return new OpenAPIHono<AdminBindings>({
    strict: false,
    defaultHook,
  })
}

export function createTestApp() {
  const app = createRouter()
  app.use(requestId()).use(pinoLogger({ pino: logger }))
  app.notFound(notFound)
  app.onError(onError)
  return app
}
