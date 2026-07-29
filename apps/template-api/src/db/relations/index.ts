import { defineRelations } from 'drizzle-orm'

import * as schema from '@/db/schema'

import { menuRelations } from './admin/menus'
import { userRolesRelations } from './admin/user-roles'

export const relations = defineRelations(schema, (r) => ({
  ...userRolesRelations(r),
  ...menuRelations(r),
}))
