import { createRoute } from '@hono/zod-openapi'

import { RefineResultSchema } from '@/lib/core/refine-query'
import { HttpStatusCodes, jsonContent, jsonContentRequired } from '@monorepo/server-core'
import { respErrSchema } from '@/utils'

import { menuChildCreateSchema, menuCreateSchema, menuIdParamsSchema, menuPatchSchema, menuResponseSchema, menuTreeResponseSchema } from './menus.schema'

const routePrefix = '/system/menus'
const tags = [`${routePrefix}（系统菜单）`]

export const tree = createRoute({
  tags,
  summary: '获取菜单管理树',
  method: 'get',
  path: `${routePrefix}/tree`,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(RefineResultSchema(menuTreeResponseSchema), '获取成功'),
  },
})

export const create = createRoute({
  tags,
  summary: '创建顶级菜单',
  method: 'post',
  path: routePrefix,
  request: { body: jsonContentRequired(menuCreateSchema, '菜单参数') },
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(RefineResultSchema(menuResponseSchema), '创建成功'),
    [HttpStatusCodes.CONFLICT]: jsonContent(respErrSchema, '菜单结构冲突'),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(respErrSchema, '参数验证失败'),
  },
})

export const createChild = createRoute({
  tags,
  summary: '新增下级菜单',
  method: 'post',
  path: `${routePrefix}/{id}/children`,
  request: {
    params: menuIdParamsSchema,
    body: jsonContentRequired(menuChildCreateSchema, '下级菜单参数'),
  },
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(RefineResultSchema(menuResponseSchema), '创建成功'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(respErrSchema, '父菜单不存在'),
    [HttpStatusCodes.CONFLICT]: jsonContent(respErrSchema, '菜单结构冲突'),
  },
})

export const update = createRoute({
  tags,
  summary: '编辑菜单',
  method: 'patch',
  path: `${routePrefix}/{id}`,
  request: {
    params: menuIdParamsSchema,
    body: jsonContentRequired(menuPatchSchema, '菜单参数'),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(RefineResultSchema(menuResponseSchema), '更新成功'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(respErrSchema, '菜单不存在'),
    [HttpStatusCodes.CONFLICT]: jsonContent(respErrSchema, '菜单结构冲突'),
  },
})

export const remove = createRoute({
  tags,
  summary: '删除菜单',
  method: 'delete',
  path: `${routePrefix}/{id}`,
  request: { params: menuIdParamsSchema },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(RefineResultSchema(menuIdParamsSchema), '删除成功'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(respErrSchema, '菜单不存在'),
    [HttpStatusCodes.CONFLICT]: jsonContent(respErrSchema, '菜单仍有下级'),
  },
})
