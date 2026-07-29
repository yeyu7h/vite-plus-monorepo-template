import { createAdminRouter } from '@/lib/core/create-app'

import * as handlers from './menu-groups.handlers'
import * as routes from './menu-groups.routes'

export default createAdminRouter().openapi(routes.list, handlers.list).openapi(routes.create, handlers.create).openapi(routes.update, handlers.update).openapi(routes.remove, handlers.remove)
