import type { AdminRouteMeta } from './src/app.d.ts'

import 'vue-router'

declare module 'vue-router' {
  // oxlint-disable-next-line typescript/no-empty-object-type
  interface RouteMeta extends AdminRouteMeta {}
}
