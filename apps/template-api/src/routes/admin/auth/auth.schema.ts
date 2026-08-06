import type { AdminAccessMenu } from './access.helpers'

import { z } from '@hono/zod-openapi'

const adminMenuIconSchema = z.union([
  z.string(),
  z.object({
    dark: z.string().optional(),
    light: z.string(),
  }),
])

const adminMenuGroupSchema = z.object({
  id: z.string(),
  label: z.string(),
  order: z.number().int(),
})

export const adminAccessMenuMetaSchema = z.object({
  activePath: z.string().optional(),
  authority: z.array(z.string()).optional(),
  contentMode: z.enum(['default', 'full']).optional(),
  description: z.string().optional(),
  externalLink: z.string().optional(),
  hideInBreadcrumb: z.boolean().optional(),
  hideInMenu: z.boolean().optional(),
  hideInTab: z.boolean().optional(),
  icon: adminMenuIconSchema.optional(),
  iframeSrc: z.string().optional(),
  ignoreAccess: z.boolean().optional(),
  keepAlive: z.boolean().optional(),
  menuGroup: z.union([adminMenuGroupSchema, z.string()]).optional(),
  menuVisibleWithForbidden: z.boolean().optional(),
  order: z.number().int().optional(),
  showActiveTabBorder: z.boolean().optional(),
  tabPath: z.string().optional(),
  title: z.string(),
})

export const adminAccessMenuSchema: z.ZodType<AdminAccessMenu> = z
  .lazy(() =>
    z.object({
      children: z.array(adminAccessMenuSchema).optional(),
      id: z.string(),
      meta: adminAccessMenuMetaSchema,
      path: z.string(),
      type: z.enum(['directory', 'menu']),
    }),
  )
  .openapi('AdminAccessMenu')

export const adminAccessPayloadSchema = z.object({
  menus: z.array(adminAccessMenuSchema),
  permissionCodes: z.array(z.string()),
})
