import { defineRoleRouteTests } from '@monorepo/api-test-suite/roles'
import { and, eq, inArray, like, or } from 'drizzle-orm'
import { jwt } from 'hono/jwt'
import db from '@/db'
import { casbinRule, systemRoles, systemUserRoles } from '@/db/schema'
import env from '@/env'
import { enforcerPromise } from '@/lib/services/casbin'
import { authorize } from '@/middlewares/authorize'
import rolesRouter from '@/routes/admin/system/roles/roles.index'
import { getAdminToken, getUserToken } from '~/tests/auth-utils'
import { createTestApp } from '~/tests/utils/test-app'

if (env.NODE_ENV !== 'test') throw new Error("NODE_ENV must be 'test'")

const app = createTestApp()
  .use('/system/roles/*', jwt({ secret: env.ADMIN_JWT_SECRET, alg: 'HS256' }))
  .use('/system/roles/*', authorize)
  .route('/', rolesRouter)

defineRoleRouteTests({
  app,
  getAdminToken,
  getUserToken,
  enforcerPromise,
  createRole: async (role) => {
    await db.insert(systemRoles).values(role)
  },
  deleteRole: async (id) => {
    await db.delete(systemRoles).where(eq(systemRoles.id, id))
  },
  cleanup: async (prefix) => {
    await db.transaction(async (tx) => {
      const roles = await tx
        .select({ id: systemRoles.id })
        .from(systemRoles)
        .where(like(systemRoles.id, `${prefix.replaceAll('_', '\\_')}%`))
      const ids = roles.map(({ id }) => id)
      if (!ids.length) return
      await tx.delete(systemUserRoles).where(inArray(systemUserRoles.roleId, ids))
      await tx.delete(casbinRule).where(or(and(eq(casbinRule.ptype, 'p'), inArray(casbinRule.v0, ids)), and(eq(casbinRule.ptype, 'g'), or(inArray(casbinRule.v0, ids), inArray(casbinRule.v1, ids)))))
      await tx.delete(systemRoles).where(inArray(systemRoles.id, ids))
    })
  },
})
