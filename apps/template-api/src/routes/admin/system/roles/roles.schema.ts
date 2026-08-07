import { z } from 'zod'

import { insertSystemRolesSchema, selectSystemRolesSchema } from '@/db/schema'
import { roleIdField } from '@/lib/schemas'
import { permissionItemSchema } from '@/lib/schemas/common-fields'
import { Status } from '@/lib/enums'

/** Patch Schema / 更新 Schema */
export const systemRolesPatchSchema = insertSystemRolesSchema
  .omit({ id: true })
  .extend({
    parentRoleIds: z.array(roleIdField).optional().describe('上级角色ID列表'),
  })
  .partial()

/** Detail response Schema (including parent roles) / 详情响应 Schema（包含上级角色） */
export const systemRolesDetailResponseSchema = selectSystemRolesSchema.extend({
  parentRoles: z.array(z.string()).optional().describe('上级角色列表'),
})

/** Create Schema (including parent role IDs) / 创建 Schema（包含上级角色ID） */
export const systemRolesCreateSchema = insertSystemRolesSchema.extend({
  parentRoleIds: z.array(roleIdField).optional().describe('上级角色ID列表'),
})

/** ID params Schema (roles use string ID, not UUID) / ID 参数 Schema（角色使用字符串 ID，非 UUID） */
export const systemRolesIdParamsSchema = z.object({
  id: roleIdField,
})

export const rolePermissionItemSchema = permissionItemSchema.extend({
  direct: z.boolean().meta({ description: '是否为当前角色的直接权限' }),
  inherited: z.boolean().meta({ description: '是否从上级角色继承' }),
  sourceRoleId: z.string().meta({ description: '权限来源角色 ID' }),
})

export const savePermissionsSchema = z.object({
  permissions: z.array(rolePermissionItemSchema).meta({ description: '权限列表' }),
  groupings: z
    .array(
      z.object({
        child: z.string().meta({ description: '子角色ID' }),
        parent: z.string().meta({ description: '父角色ID' }),
      }),
    )
    .meta({ description: '角色继承关系列表' }),
})

/** List response Schema / 列表响应 Schema */
export const systemRolesListResponseSchema = z.array(systemRolesDetailResponseSchema)

/** Save role permissions Schema / 保存角色权限 Schema */
export const savePermissionsParamsSchema = z.object({
  permissions: z.array(z.tuple([z.string().min(1).meta({ description: '资源' }), z.string().min(1).meta({ description: '操作' })])).meta({ description: '权限列表（全量）' }),
  parentRoleIds: z
    .array(
      z
        .string()
        .min(1)
        .regex(/^[a-z0-9_]+$/),
    )
    .optional()
    .meta({ description: '上级角色ID列表（可选）' }),
})

/** Save role permissions response Schema / 保存角色权限响应 Schema */
export const savePermissionsResponseSchema = z.object({
  added: z.number().int().meta({ description: '新增权限数量' }),
  removed: z.number().int().meta({ description: '删除权限数量' }),
  total: z.number().int().meta({ description: '总权限数量' }),
})

const roleMenuAuthorizationBaseSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum(['directory', 'menu', 'button']),
  status: z.enum([Status.ENABLED, Status.DISABLED]),
  accessScope: z.enum(['public', 'restricted']),
  permissionCode: z.string().nullable(),
  checked: z.boolean(),
  direct: z.boolean(),
  inherited: z.boolean(),
  readOnly: z.boolean(),
})

export type RoleMenuAuthorizationNode = z.infer<typeof roleMenuAuthorizationBaseSchema> & { children?: RoleMenuAuthorizationNode[] }

export const roleMenuAuthorizationNodeSchema: z.ZodType<RoleMenuAuthorizationNode> = z
  .lazy(() => roleMenuAuthorizationBaseSchema.extend({ children: z.array(roleMenuAuthorizationNodeSchema).optional() }))
  .meta({ id: 'RoleMenuAuthorizationNode' })

export const roleMenuAuthorizationResponseSchema = z.object({
  roleId: roleIdField,
  readOnly: z.boolean(),
  menuIds: z.array(z.string()).meta({ description: '全部已授权菜单 ID' }),
  directMenuIds: z.array(z.string()).meta({ description: '当前角色直接授权菜单 ID' }),
  inheritedMenuIds: z.array(z.string()).meta({ description: '继承授权菜单 ID' }),
  tree: z.array(roleMenuAuthorizationNodeSchema),
})

export const saveRoleMenusSchema = z.object({
  menuIds: z.array(z.string().min(1).max(128)).meta({ description: '当前角色直接菜单授权（全量）' }),
})

export const saveRoleMenusResponseSchema = z.object({
  total: z.number().int(),
  menuIds: z.array(z.string()),
})
