import { createRefineQuery } from '@monorepo/server-refine-query'
import db from '@/db'
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@/lib/constants'
import logger from '@/lib/services/logger'

export * from '@monorepo/server-refine-query'

export const executeRefineQuery = createRefineQuery({
  db,
  logger,
  pagination: {
    defaultPageSize: DEFAULT_PAGE_SIZE,
    maxPageSize: MAX_PAGE_SIZE,
  },
})
