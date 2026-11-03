import { defineQueryExecutorTests } from '@monorepo/api-test-suite/refine-query'
import { like } from 'drizzle-orm'
import db from '@/db'
import { systemRoles } from '@/db/schema'
import env from '@/env'
import { executeRefineQuery } from '../index'

if (env.NODE_ENV !== 'test') throw new Error("NODE_ENV must be 'test'")

defineQueryExecutorTests({
  db,
  table: systemRoles,
  executeRefineQuery,
  prepare: async (rows) => {
    await db.insert(systemRoles).values(rows)
  },
  cleanup: async (prefix) => {
    await db.delete(systemRoles).where(like(systemRoles.id, `${prefix.replaceAll('_', '\\_')}%`))
  },
})
