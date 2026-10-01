import type { HealthRouteHandlerType } from './health.types'

import { format } from 'date-fns'
import { HttpStatusCodes } from '@monorepo/server-core'

import { Resp } from '@/utils'

export const get: HealthRouteHandlerType<'get'> = async (c) => {
  return c.json(
    Resp.ok({
      status: 'ok',
      timestamp: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
    }),
    HttpStatusCodes.OK,
  )
}
