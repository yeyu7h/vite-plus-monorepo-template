import { defineUserRouteTests } from '@monorepo/api-test-suite/users'
import { and, eq, inArray, like } from 'drizzle-orm'
import { jwt } from 'hono/jwt'
import db from '@/db'
import { casbinRule, systemUserRoles, systemUsers } from '@/db/schema'
import env from '@/env'
import { enforcerPromise } from '@/lib/services/casbin'
import { createAdminSession, getAdminSession, revokeAdminSession, revokeAdminSessionsForUser } from '@/lib/services/admin-session'
import { authorize } from '@/middlewares/authorize'
import usersRouter from '@/routes/admin/system/users/users.index'
import { getAdminToken, getUserToken } from '~/tests/auth-utils'
import { createTestApp } from '~/tests/utils/test-app'

if (env.NODE_ENV !== 'test') throw new Error("NODE_ENV must be 'test'")

const app = createTestApp()
  .use('/system/users/*', jwt({ secret: env.ADMIN_JWT_SECRET, alg: 'HS256' }))
  .use('/system/users/*', authorize)
  .route('/', usersRouter)

defineUserRouteTests({
  app,
  getAdminToken,
  getUserToken,
  enforcerPromise,
  createAdminSession,
  getAdminSession,
  revokeAdminSession,
  cleanup: async (prefix) => {
    await db.transaction(async (tx) => {
      const users = await tx
        .select({ id: systemUsers.id })
        .from(systemUsers)
        .where(like(systemUsers.username, `${prefix}\\_%`))
      const ids = users.map(({ id }) => id)
      if (!ids.length) return
      await Promise.all(ids.map(revokeAdminSessionsForUser))
      await tx.delete(systemUserRoles).where(inArray(systemUserRoles.userId, ids))
      await tx.delete(casbinRule).where(and(eq(casbinRule.ptype, 'g'), inArray(casbinRule.v0, ids)))
      await tx.delete(systemUsers).where(inArray(systemUsers.id, ids))
    })
  },
})
