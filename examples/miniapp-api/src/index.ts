import type { RouteModule, TierMiddleware } from '@monorepo/server-core'
import { createApplication } from '@monorepo/server-core'
import env from '@/env'
import { bootstrap } from '@/lib/infrastructure/bootstrap'
import createApp from '@/lib/core/create-app'
import config from '~/app.config'
import packageJson from '../package.json' with { type: 'json' }

const routes = import.meta.glob<{ default: RouteModule['default'] }>('./routes/**/*.index.ts', {
  eager: true,
})
const middlewares = import.meta.glob<{ default: TierMiddleware[] }>('./routes/*/_middleware.ts', {
  eager: true,
})

await bootstrap()

export default await createApplication(config, {
  env,
  version: packageJson.version,
  routes,
  middlewares,
  createApp,
})
