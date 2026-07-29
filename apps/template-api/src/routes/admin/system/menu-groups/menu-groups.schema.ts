import { z } from 'zod'

import { selectSystemMenuGroupSchema } from '@/db/schema'

export const menuGroupIdParamsSchema = z.object({
  id: z.uuid('菜单分组 ID 格式错误'),
})

export const menuGroupCreateSchema = z.object({
  name: z.string().trim().min(1, '分组名称不能为空').max(128, '分组名称最多 128 个字符'),
  order: z.number().int().min(0).default(0),
})

export const menuGroupPatchSchema = menuGroupCreateSchema.partial().refine((data) => Object.keys(data).length > 0, {
  message: '至少需要提供一个字段进行更新',
})

export const menuGroupResponseSchema = selectSystemMenuGroupSchema
export const menuGroupListResponseSchema = z.array(menuGroupResponseSchema)
