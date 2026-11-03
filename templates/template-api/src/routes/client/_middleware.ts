import { defineMiddleware } from '@monorepo/server-core'
import { createClientAuthentication } from '@/middlewares/client-authenticate'

// Inject the business application's client authentication adapter here.
// The default rejects access, including administrator tokens.
export default defineMiddleware([createClientAuthentication()])
