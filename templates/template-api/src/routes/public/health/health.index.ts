import { createPublicRouter } from '@/lib/core/create-app'

import * as handlers from './health.handlers'
import * as routes from './health.routes'

const health = createPublicRouter().openapi(routes.get, handlers.get).openapi(routes.ready, handlers.ready)

export default health
