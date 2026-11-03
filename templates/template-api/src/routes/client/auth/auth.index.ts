import { createClientRouter } from '@/lib/core/create-app'
import * as routes from './auth.routes'
import * as handlers from './auth.handlers'

export default createClientRouter().openapi(routes.login, handlers.login).openapi(routes.refresh, handlers.refresh).openapi(routes.logout, handlers.logout).openapi(routes.userinfo, handlers.userinfo)
