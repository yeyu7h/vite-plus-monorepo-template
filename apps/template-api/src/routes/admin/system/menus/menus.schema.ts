import type { z } from 'zod'

import { z as zod } from 'zod'

import { insertSystemMenusSchema, selectSystemMenusSchema } from '@/db/schema'
import { Status } from '@/lib/enums'

export const menuAccessScopeSchema = zod.enum(['public', 'restricted']).meta({ description: '访问范围' })
export const menuIdField = zod
  .string()
  .min(1, '菜单 ID 不能为空')
  .max(128, '菜单 ID 最多 128 个字符')
  .regex(/^[a-z0-9_-]+$/, '菜单 ID 只能包含小写字母、数字、下划线和连字符')

const menuIconSchema = zod.union([zod.string(), zod.object({ dark: zod.string().optional(), light: zod.string().min(1) })])

const menuFields = {
  id: menuIdField,
  parentId: zod.string().min(1).max(128).nullable().optional().meta({ description: '父菜单 ID' }),
  type: zod.enum(['group', 'directory', 'menu', 'button']).meta({ description: '节点类型' }),
  path: zod.string().trim().min(1, '路径不能为空').max(255, '路径最多 255 个字符').nullable().optional().meta({ description: '路由或按钮路径；分组节点为空' }),
  title: zod.string().trim().min(1, '标题不能为空').max(128, '标题最多 128 个字符').meta({ description: '标题' }),
  description: zod.string().max(1000).nullable().optional(),
  icon: menuIconSchema.nullable().optional(),
  activePath: zod.string().max(255).nullable().optional(),
  externalLink: zod.string().max(2000).nullable().optional(),
  iframeSrc: zod.string().max(2000).nullable().optional(),
  contentMode: zod.enum(['default', 'full']).nullable().optional(),
  hideInBreadcrumb: zod.boolean().optional(),
  hideInMenu: zod.boolean().optional(),
  hideInTab: zod.boolean().optional(),
  ignoreAccess: zod.boolean().optional(),
  keepAlive: zod.boolean().optional(),
  menuVisibleWithForbidden: zod.boolean().optional(),
  order: zod.number().int('排序必须是整数').optional(),
  permissionCode: zod.string().trim().min(1).max(128).nullable().optional(),
  showActiveTabBorder: zod.boolean().optional(),
  tabPath: zod.string().max(255).nullable().optional(),
  status: zod.enum([Status.ENABLED, Status.DISABLED]).optional(),
  accessScope: menuAccessScopeSchema.optional(),
}

function validateTypeFields(
  data: { accessScope?: 'public' | 'restricted'; parentId?: string | null; path?: string | null; permissionCode?: string | null; type?: 'group' | 'button' | 'directory' | 'menu' },
  ctx: z.RefinementCtx,
) {
  if (data.type === 'group') {
    if (data.parentId) ctx.addIssue({ code: 'custom', path: ['parentId'], message: '菜单分组只能位于顶层' })
    if (data.path) ctx.addIssue({ code: 'custom', path: ['path'], message: '菜单分组不能设置路径' })
    if (data.accessScope === 'restricted') ctx.addIssue({ code: 'custom', path: ['accessScope'], message: '菜单分组不参与角色授权' })
  } else if (data.type && !data.path) {
    ctx.addIssue({ code: 'custom', path: ['path'], message: '非分组节点必须设置路径' })
  }
  if (data.type === 'button' && !data.permissionCode) {
    ctx.addIssue({ code: 'custom', path: ['permissionCode'], message: '按钮节点必须设置权限码' })
  }
  if (data.type && data.type !== 'button' && data.permissionCode) {
    ctx.addIssue({ code: 'custom', path: ['permissionCode'], message: '只有按钮节点可以设置权限码' })
  }
}

export const menuCreateSchema = insertSystemMenusSchema.extend(menuFields).superRefine(validateTypeFields)

export const menuPatchSchema = insertSystemMenusSchema
  .omit({ id: true })
  .extend(menuFields)
  .omit({ id: true })
  .partial()
  .refine((data) => Object.keys(data).length > 0, { message: '至少需要提供一个字段进行更新' })

export const menuIdParamsSchema = zod.object({ id: menuIdField })

const menuResponseBaseSchema = selectSystemMenusSchema.extend({
  accessScope: menuAccessScopeSchema,
  roleIds: zod.array(zod.string()),
})

export type MenuTreeNode = z.infer<typeof menuResponseBaseSchema> & { children?: MenuTreeNode[] }

export const menuTreeNodeSchema: z.ZodType<MenuTreeNode> = zod.lazy(() => menuResponseBaseSchema.extend({ children: zod.array(menuTreeNodeSchema).optional() })).meta({ id: 'AdminMenuManagementNode' })

export const menuTreeResponseSchema = zod.array(menuTreeNodeSchema)
export const menuDeleteResponseSchema = zod.object({ id: menuIdField, deletedCount: zod.number().int().positive() })
