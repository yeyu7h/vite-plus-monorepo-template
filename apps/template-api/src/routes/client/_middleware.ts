import { jwt } from 'hono/jwt'

import env from '@/env'
import { defineMiddleware } from '@monorepo/server-core'

export default defineMiddleware([jwt({ secret: env.CLIENT_JWT_SECRET, alg: 'HS256' })])
