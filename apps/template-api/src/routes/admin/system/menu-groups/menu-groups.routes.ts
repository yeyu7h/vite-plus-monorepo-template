import { createRoute } from '@hono/zod-openapi'

import { RefineQueryParamsSchema, RefineResultSchema } from '@/lib/core/refine-query'
import { HttpStatusCodes, jsonContent, jsonContentRequired } from '@monorepo/server-core'
import { respErrSchema } from '@/utils'

import { menuGroupCreateSchema, menuGroupIdParamsSchema, menuGroupListResponseSchema, menuGroupPatchSchema, menuGroupResponseSchema } from './menu-groups.schema'

const routePrefix = '/system/menu-groups'
const tags = [`${routePrefix}（菜单分组管理）`]

export const list = createRoute({
  tags,
  summary: '获取菜单分组列表',
  method: 'get',
  path: routePrefix,
  request: { query: RefineQueryParamsSchema },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(RefineResultSchema(menuGroupListResponseSchema), '获取成功'),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(respErrSchema, '查询参数验证失败'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(respErrSchema, '服务器内部错误'),
  },
})

export const create = createRoute({
  tags,
  summary: '创建菜单分组',
  method: 'post',
  path: routePrefix,
  request: { body: jsonContentRequired(menuGroupCreateSchema, '创建菜单分组参数') },
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(RefineResultSchema(menuGroupResponseSchema), '创建成功'),
    [HttpStatusCodes.CONFLICT]: jsonContent(respErrSchema, '菜单分组 ID 已存在'),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(respErrSchema, '参数验证失败'),
  },
})

export const update = createRoute({
  tags,
  summary: '更新菜单分组',
  method: 'patch',
  path: `${routePrefix}/{id}`,
  request: {
    params: menuGroupIdParamsSchema,
    body: jsonContentRequired(menuGroupPatchSchema, '更新菜单分组参数'),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(RefineResultSchema(menuGroupResponseSchema), '更新成功'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(respErrSchema, '菜单分组不存在'),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(respErrSchema, '参数验证失败'),
  },
})

export const remove = createRoute({
  tags,
  summary: '删除菜单分组',
  method: 'delete',
  path: `${routePrefix}/{id}`,
  request: { params: menuGroupIdParamsSchema },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(RefineResultSchema(menuGroupIdParamsSchema), '删除成功'),
    [HttpStatusCodes.CONFLICT]: jsonContent(respErrSchema, '菜单分组仍被菜单引用'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(respErrSchema, '菜单分组不存在'),
  },
})
