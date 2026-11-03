import { defineConfig } from 'drizzle-kit'

import env from '@/env'

export default defineConfig({
  schema: './src/db/schema',
  out: './migrations',
  dialect: 'postgresql',
  // This migration chain is independent of the legacy application history.
  migrations: { table: '__drizzle_migrations_generic_api' },
  dbCredentials: {
    url: env.DATABASE_URL,
  },
  verbose: true,
  strict: true,
  schemaFilter: ['public'],
})
