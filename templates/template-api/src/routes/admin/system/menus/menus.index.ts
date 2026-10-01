import { createAdminRouter } from '@/lib/core/create-app'

import * as handlers from './menus.handlers'
import * as routes from './menus.routes'

export default createAdminRouter().openapi(routes.tree, handlers.tree).openapi(routes.create, handlers.create).openapi(routes.update, handlers.update).openapi(routes.remove, handlers.remove)
