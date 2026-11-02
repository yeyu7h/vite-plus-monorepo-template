import { defineMiddleware } from '@monorepo/server-core'
import { createClientAuthentication } from '@/middlewares/client-authenticate'
import { clientSessions } from '@/lib/services/client-auth'

export default defineMiddleware([createClientAuthentication(clientSessions.authenticate)])
