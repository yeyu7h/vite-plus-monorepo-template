import { createAdminRouter } from '@/lib/core/create-app'
import * as handlers from './cache.handlers'
import * as routes from './cache.routes'

export default createAdminRouter().openapi(routes.list, handlers.list).openapi(routes.remove, handlers.remove).openapi(routes.clear, handlers.clear)
