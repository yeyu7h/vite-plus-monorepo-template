import { sql } from 'drizzle-orm'
import { bigint, check, snakeCase, varchar } from 'drizzle-orm/pg-core'

/** Durable atomic business UID sequence, independent of administration accounts. */
export const clientUserUidCounters = snakeCase.table(
  'client_user_uid_counters',
  {
    id: varchar({ length: 1 }).primaryKey(),
    value: bigint({ mode: 'bigint' }).notNull(),
  },
  (table) => [check('client_user_uid_counters_prefix_check', sql`${table.id} ~ '^[1-9]$'`), check('client_user_uid_counters_value_check', sql`${table.value} > 0`)],
)
