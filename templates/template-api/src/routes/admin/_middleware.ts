import { jwt } from 'hono/jwt'
import type { Context } from 'hono'

import env from '@/env'
import { defineMiddleware } from '@monorepo/server-core'
import { authorize } from '@/middlewares/authorize'
import { operationLog } from '@/middlewares/operation-log'

const publicAuthRoutes = new Set(['POST /auth/login', 'POST /auth/refresh', 'POST /auth/challenge', 'POST /auth/redeem'])
const authRoutes = new Set([...publicAuthRoutes, 'POST /auth/logout', 'GET /auth/userinfo', 'GET /auth/access', 'GET /auth/permissions'])

function getAdminRouteKey(c: Context): string {
  const basePath: unknown = c.get('tierBasePath')
  if (typeof basePath !== 'string' || !c.req.path.startsWith(`${basePath}/`)) return ''
  const path = c.req.path.slice(basePath.length).replace(/\/+$/, '')
  return `${c.req.method} ${path}`
}

export default defineMiddleware([
  {
    handler: jwt({ secret: env.ADMIN_JWT_SECRET, alg: 'HS256' }),
    except: (c) => publicAuthRoutes.has(getAdminRouteKey(c)),
  },
  {
    handler: authorize,
    except: (c) => authRoutes.has(getAdminRouteKey(c)),
  },
  {
    handler: operationLog(),
    except: (c) => authRoutes.has(getAdminRouteKey(c)),
  },
])
