import { and, eq, sql } from 'drizzle-orm'
import { format } from 'date-fns'
import { formatUserUid } from './uid'
import type { MiniappIdentity } from '@/lib/services/miniapp-auth/config'
import db from '@/db'
import { clientUsers, clientUserIdentities, clientUserUidCounters } from '@/db/schema'
import env from '@/env'
import { Status } from '@/lib/enums'
import { ClientAuthError } from './contracts'
import type { ClientUser } from './contracts'

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

async function allocateUid(tx: Transaction): Promise<string> {
  const [counter] = await tx
    .insert(clientUserUidCounters)
    .values({ id: env.USER_UID_PREFIX, value: 1n })
    .onConflictDoUpdate({
      target: clientUserUidCounters.id,
      set: { value: sql`${clientUserUidCounters.value} + 1` },
    })
    .returning()
  return formatUserUid(counter.id, counter.value)
}

function toClientUser(user: typeof clientUsers.$inferSelect): ClientUser {
  if (!user.uid) throw new Error('Client account has no UID')
  return { id: user.id, uid: user.uid, nickname: user.nickname, avatar: user.avatar, createdAt: user.createdAt }
}

/** Serializes first login for one identity; registration, UID and identity all commit together. */
export async function resolveMiniappUser(identity: MiniappIdentity): Promise<{ user: ClientUser; isNewUser: boolean }> {
  return db.transaction(async (tx) => {
    const identityKey = JSON.stringify([identity.provider, identity.appId, identity.subjectType, identity.subject])
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${identityKey}, 0))`)
    const match = and(
      eq(clientUserIdentities.provider, identity.provider),
      eq(clientUserIdentities.appId, identity.appId),
      eq(clientUserIdentities.subjectType, identity.subjectType),
      eq(clientUserIdentities.subject, identity.subject),
    )
    const [existing] = await tx.select({ user: clientUsers }).from(clientUserIdentities).innerJoin(clientUsers, eq(clientUsers.id, clientUserIdentities.userId)).where(match).limit(1)
    const now = format(new Date(), 'yyyy-MM-dd HH:mm:ss')
    if (existing) {
      if (existing.user.status !== Status.ENABLED) throw new ClientAuthError('disabled')
      const [updated] = await tx.update(clientUsers).set({ lastLoginDate: now }).where(eq(clientUsers.id, existing.user.id)).returning()
      await tx
        .update(clientUserIdentities)
        .set({ lastLoginDate: now, ...(identity.unionId ? { unionId: identity.unionId } : {}) })
        .where(match)
      return { user: toClientUser(updated), isNewUser: false }
    }
    const uid = await allocateUid(tx)
    const [created] = await tx
      .insert(clientUsers)
      .values({ uid, nickname: `用户${uid}`, registerSource: identity.provider, lastLoginDate: now })
      .returning()
    await tx.insert(clientUserIdentities).values({ ...identity, userId: created.id, lastLoginDate: now })
    return { user: toClientUser(created), isNewUser: true }
  })
}

export async function findActiveClientUser(id: string): Promise<ClientUser | null> {
  const [user] = await db.select().from(clientUsers).where(eq(clientUsers.id, id)).limit(1)
  if (!user || !user.uid) return null
  if (user.status !== Status.ENABLED) throw new ClientAuthError('disabled')
  return toClientUser(user)
}
