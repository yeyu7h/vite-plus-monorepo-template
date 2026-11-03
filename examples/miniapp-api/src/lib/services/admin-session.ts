import crypto from 'node:crypto'

import { getCurrentAdminUserRoles, getEffectiveEnabledRoleIds } from '@/lib/services/admin-roles'
import { enforcerPromise } from '@/lib/services/casbin'
import { getRoleApiPermissions } from '@/lib/services/casbin/permissions'
import redisClient from '@/lib/services/redis'
import { REFRESH_TOKEN_EXPIRES_DAYS } from '@/lib/constants'

export type AdminSession = {
  userId: string
  sessionId: string
  roles: string[]
  effectiveRoles: string[]
  permissions: string[][]
  groupings: string[][]
}

const SESSION_TTL_SECONDS = REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60
const ONLINE_USERS_KEY = 'admin:online-users'
const sessionKey = (userId: string, sessionId: string) => `{user.${userId}}:admin:session:${sessionId}`
const sessionIndexKey = (userId: string) => `{user.${userId}}:admin:sessions`

async function buildAdminSession(userId: string, sessionId: string): Promise<AdminSession | null> {
  const roles = await getCurrentAdminUserRoles(userId)
  if (!roles) return null

  const effectiveRoles = await getEffectiveEnabledRoleIds(roles)
  const enforcer = await enforcerPromise
  const permissions = (await Promise.all(effectiveRoles.map((role) => (role === 'admin' ? getRoleApiPermissions(enforcer, role) : enforcer.getPermissionsForUser(role))))).flat()
  const roleSet = new Set(effectiveRoles)
  const groupings = (await enforcer.getGroupingPolicy()).filter(([child, parent]) => roleSet.has(child) && roleSet.has(parent))
  return { userId, sessionId, roles, effectiveRoles, permissions, groupings }
}

async function saveAdminSession(session: AdminSession) {
  await redisClient.set(sessionKey(session.userId, session.sessionId), JSON.stringify(session), 'EX', SESSION_TTL_SECONDS)
  await redisClient.sadd(sessionIndexKey(session.userId), session.sessionId)
  await redisClient.sadd(ONLINE_USERS_KEY, session.userId)
}

export async function createAdminSession(userId: string): Promise<AdminSession> {
  const session = await buildAdminSession(userId, crypto.randomUUID())
  if (!session) throw new Error('User is no longer active')
  await saveAdminSession(session)
  return session
}

export async function getAdminSession(userId: string, sessionId: string): Promise<AdminSession | null> {
  const raw = await redisClient.get(sessionKey(userId, sessionId))
  if (!raw) return null
  const session = JSON.parse(raw) as AdminSession
  return session.userId === userId && session.sessionId === sessionId ? session : null
}

export async function getAdminActorRoles(payload: { sub: string; roles: string[]; sessionId?: string }): Promise<string[] | null> {
  if (!payload.sessionId) return payload.roles
  return (await getAdminSession(payload.sub, payload.sessionId))?.roles ?? null
}

export async function refreshAdminSession(userId: string, sessionId: string): Promise<AdminSession | null> {
  if (!(await getAdminSession(userId, sessionId))) return null
  const session = await buildAdminSession(userId, sessionId)
  if (!session) return null
  await saveAdminSession(session)
  return session
}

export async function refreshAdminSessionsForUser(userId: string): Promise<void> {
  const sessionIds = await redisClient.smembers(sessionIndexKey(userId))
  for (const sessionId of sessionIds) {
    if (!(await getAdminSession(userId, sessionId))) {
      await redisClient.srem(sessionIndexKey(userId), sessionId)
      continue
    }
    const session = await buildAdminSession(userId, sessionId)
    if (session) await saveAdminSession(session)
    else await revokeAdminSessionsForUser(userId)
  }
  if ((await redisClient.scard(sessionIndexKey(userId))) === 0) await redisClient.srem(ONLINE_USERS_KEY, userId)
}

/** Role changes are rare; refresh the online sessions, including inherited-role users. */
export async function refreshAllAdminSessions(): Promise<void> {
  const userIds = await redisClient.smembers(ONLINE_USERS_KEY)
  for (const userId of userIds) await refreshAdminSessionsForUser(userId)
}

export async function revokeAdminSessionsForUser(userId: string): Promise<void> {
  const sessionIds = await redisClient.smembers(sessionIndexKey(userId))
  if (sessionIds.length > 0) await redisClient.del(...sessionIds.map((sessionId) => sessionKey(userId, sessionId)))
  await redisClient.del(sessionIndexKey(userId))
  await redisClient.srem(ONLINE_USERS_KEY, userId)
}

export async function revokeAdminSession(userId: string, sessionId: string): Promise<void> {
  await redisClient.del(sessionKey(userId, sessionId))
  await redisClient.srem(sessionIndexKey(userId), sessionId)
  if ((await redisClient.scard(sessionIndexKey(userId))) === 0) await redisClient.srem(ONLINE_USERS_KEY, userId)
}
