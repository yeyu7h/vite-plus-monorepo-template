import { index, snakeCase, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core'
import type { MiniappIdentity } from '@monorepo/server-miniapp-auth'
import { baseColumns } from '../../_shard/base-columns'
import { clientUsers } from './users'

/** Verified business login identities; cannot reference an administration account. */
export const clientUserIdentities = snakeCase.table(
  'client_user_identities',
  {
    id: baseColumns.id,
    userId: uuid()
      .notNull()
      .references(() => clientUsers.id, { onDelete: 'cascade' }),
    provider: varchar({ length: 16 }).$type<MiniappIdentity['provider']>().notNull(),
    appId: varchar({ length: 64 }).notNull(),
    subjectType: varchar({ length: 16 }).$type<MiniappIdentity['subjectType']>().notNull(),
    subject: varchar({ length: 128 }).notNull(),
    unionId: varchar({ length: 128 }),
    createdAt: baseColumns.createdAt,
    lastLoginDate: timestamp({ mode: 'string', precision: 0 }),
  },
  (table) => [unique('client_user_identities_provider_subject_unique').on(table.provider, table.appId, table.subjectType, table.subject), index('client_user_identities_user_id_idx').on(table.userId)],
)
