import type { HealthRouteHandlerType } from './health.types'

import { format } from 'date-fns'
import { HttpStatusCodes } from '@monorepo/server-core'

import { Resp } from '@/utils'
import { checkReadiness } from '@/lib/infrastructure/readiness'

export const get: HealthRouteHandlerType<'get'> = async (c) => {
  c.header('Cache-Control', 'no-store')
  return c.json(
    Resp.ok({
      status: 'ok',
      timestamp: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
    }),
    HttpStatusCodes.OK,
  )
}

export const ready: HealthRouteHandlerType<'ready'> = async (c) => {
  c.header('Cache-Control', 'no-store')
  const result = await checkReadiness()
  const data = { ...result, timestamp: format(new Date(), 'yyyy-MM-dd HH:mm:ss') }
  if (result.status === 'not_ready') return c.json({ ...Resp.fail('服务尚未就绪'), data }, HttpStatusCodes.SERVICE_UNAVAILABLE)
  return c.json(Resp.ok(data), HttpStatusCodes.OK)
}
