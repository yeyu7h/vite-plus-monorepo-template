import { defineConfig } from 'drizzle-kit'

import env from '@/env'

export default defineConfig({
  schema: './src/db/schema',
  out: './migrations',
  dialect: 'postgresql',
  // This baseline belongs to newly created generic applications, independently of the preserved example history.
  migrations: { table: '__drizzle_migrations_generic_api' },
  dbCredentials: {
    url: env.DATABASE_URL,
  },
  verbose: true,
  strict: true,
  schemaFilter: ['public'],
})
