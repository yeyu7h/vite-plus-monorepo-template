import type { NotFoundHandler } from 'hono'
import { HttpStatusCodes, HttpStatusPhrases } from '@monorepo/server-core'

import { Resp } from '@/utils'

const notFound: NotFoundHandler = (c) => {
  return c.json(Resp.fail(`${HttpStatusPhrases.NOT_FOUND} - ${c.req.path}`), HttpStatusCodes.NOT_FOUND)
}

export default notFound
