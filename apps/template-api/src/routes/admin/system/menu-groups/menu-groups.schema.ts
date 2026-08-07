import { z } from 'zod'

import { insertSystemMenuGroupsSchema, selectSystemMenuGroupsSchema } from '@/db/schema'
import { Status } from '@/lib/enums'

export const menuGroupIdField = z
  .string()
  .min(1, '菜单分组 ID 不能为空')
  .max(64, '菜单分组 ID 最多 64 个字符')
  .regex(/^[a-z0-9_-]+$/, '菜单分组 ID 只能包含小写字母、数字、下划线和连字符')
  .meta({ description: '菜单分组 ID' })

const menuGroupFields = {
  id: menuGroupIdField,
  label: z.string().trim().min(1, '菜单分组标题不能为空').max(128, '菜单分组标题最多 128 个字符').meta({ description: '菜单分组标题' }),
  order: z.number().int('排序必须是整数').default(0).meta({ description: '排序序号' }),
  status: z.enum([Status.ENABLED, Status.DISABLED]).default(Status.ENABLED).meta({ description: '状态' }),
}

export const menuGroupCreateSchema = insertSystemMenuGroupsSchema.extend(menuGroupFields)

export const menuGroupPatchSchema = insertSystemMenuGroupsSchema
  .omit({ id: true })
  .extend({
    label: menuGroupFields.label,
    order: menuGroupFields.order,
    status: menuGroupFields.status,
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, { message: '至少需要提供一个字段进行更新' })

export const menuGroupIdParamsSchema = z.object({ id: menuGroupIdField })
export const menuGroupResponseSchema = selectSystemMenuGroupsSchema
export const menuGroupListResponseSchema = z.array(menuGroupResponseSchema)
