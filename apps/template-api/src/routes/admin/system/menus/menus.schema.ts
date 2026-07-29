import { z } from 'zod'

import { MenuType } from '@/lib/enums'

export const menuIdParamsSchema = z.object({
  id: z.uuid('菜单 ID 格式错误'),
})

const nullableUuid = z.uuid().nullable()
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional()

export const menuIconSchema = z.union([
  z.string().trim().min(1).max(2048),
  z.object({
    light: z.url().max(2048),
    dark: z.url().max(2048).optional(),
  }),
])

export const menuMutationFieldsSchema = z.object({
  parentId: nullableUuid.optional(),
  groupId: nullableUuid.optional(),
  type: z.enum([MenuType.DIRECTORY, MenuType.PAGE, MenuType.EXTERNAL, MenuType.IFRAME, MenuType.BUTTON]),
  title: z.string().trim().min(1, '名称不能为空').max(128),
  path: optionalText(254),
  icon: menuIconSchema.nullable().optional(),
  order: z.number().int().min(0).default(0),
  activePath: optionalText(254),
  contentMode: z.enum(['default', 'full']).nullable().optional(),
  description: optionalText(2048),
  externalLink: optionalText(2048),
  hideInBreadcrumb: z.boolean().default(false),
  hideInMenu: z.boolean().default(false),
  hideInTab: z.boolean().default(false),
  iframeSrc: optionalText(2048),
  ignoreAccess: z.boolean().default(false),
  keepAlive: z.boolean().default(false),
  menuVisibleWithForbidden: z.boolean().default(false),
  showActiveTabBorder: z.boolean().default(false),
  tabPath: optionalText(254),
  permissionCode: optionalText(128),
  resource: optionalText(254),
  action: optionalText(64),
})

export const menuCreateSchema = menuMutationFieldsSchema
export const menuChildCreateSchema = menuMutationFieldsSchema.omit({ parentId: true, groupId: true })
export const menuPatchSchema = menuMutationFieldsSchema.partial().refine((data) => Object.keys(data).length > 0, {
  message: '至少需要提供一个字段进行更新',
})

export const menuResponseSchema = z.object({
  id: z.uuid(),
  parentId: nullableUuid,
  groupId: nullableUuid,
  type: z.enum([MenuType.DIRECTORY, MenuType.PAGE, MenuType.EXTERNAL, MenuType.IFRAME, MenuType.BUTTON]),
  title: z.string(),
  path: z.string().nullable(),
  icon: menuIconSchema.nullable(),
  order: z.number().int(),
  activePath: z.string().nullable(),
  contentMode: z.enum(['default', 'full']).nullable(),
  description: z.string().nullable(),
  externalLink: z.string().nullable(),
  hideInBreadcrumb: z.boolean(),
  hideInMenu: z.boolean(),
  hideInTab: z.boolean(),
  iframeSrc: z.string().nullable(),
  ignoreAccess: z.boolean(),
  keepAlive: z.boolean(),
  menuVisibleWithForbidden: z.boolean(),
  showActiveTabBorder: z.boolean(),
  tabPath: z.string().nullable(),
  permissionCode: z.string().nullable(),
  resource: z.string().nullable(),
  action: z.string().nullable(),
  children: z.array(z.any()),
  createdAt: z.string().nullable(),
  createdBy: z.string().nullable(),
  updatedAt: z.string().nullable(),
  updatedBy: z.string().nullable(),
})

export const menuTreeResponseSchema = z.array(menuResponseSchema)
