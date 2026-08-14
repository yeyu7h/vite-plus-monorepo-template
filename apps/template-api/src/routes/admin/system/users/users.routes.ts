import { createRoute } from '@hono/zod-openapi'

import { RefineQueryParamsSchema, RefineResultSchema } from '@/lib/core/refine-query'
import { HttpStatusCodes } from '@monorepo/server-core'
import { jsonContent, jsonContentRequired } from '@monorepo/server-core'
import { IdUUIDParamsSchema } from '@monorepo/server-core'
import { respErrSchema } from '@/utils'

import { systemUsersDetailResponseSchema, systemUsersCreateSchema, systemUsersListResponseSchema, systemUsersPatchSchema } from './users.schema'

const routePrefix = '/system/users'
const tags = [`${routePrefix}（系统用户）`]

/** Get system user paginated list / 获取系统用户分页列表 */
export const list = createRoute({
  tags,
  summary: '获取系统用户列表',
  method: 'get',
  path: routePrefix,
  request: {
    query: RefineQueryParamsSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(RefineResultSchema(systemUsersListResponseSchema), '列表响应成功'),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(respErrSchema, '查询参数验证错误'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(respErrSchema, '服务器内部错误'),
  },
})

/** Create system user / 创建系统用户 */
export const create = createRoute({
  tags,
  summary: '创建系统用户',
  method: 'post',
  path: routePrefix,
  request: {
    body: jsonContentRequired(systemUsersCreateSchema, '创建系统用户参数'),
  },
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(RefineResultSchema(systemUsersDetailResponseSchema), '创建成功'),
    [HttpStatusCodes.CONFLICT]: jsonContent(respErrSchema, '用户名已存在'),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(respErrSchema, '角色不存在或已禁用'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(respErrSchema, '角色不存在'),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(respErrSchema, '参数验证失败'),
  },
})

/** Get system user details by ID / 根据ID获取系统用户详情 */
export const get = createRoute({
  tags,
  summary: '获取系统用户详情',
  method: 'get',
  path: `${routePrefix}/{id}`,
  request: {
    params: IdUUIDParamsSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(RefineResultSchema(systemUsersDetailResponseSchema), '获取成功'),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(respErrSchema, 'ID参数错误'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(respErrSchema, '用户不存在'),
  },
})

/** Update system user / 更新系统用户 */
export const update = createRoute({
  tags,
  summary: '更新系统用户',
  method: 'patch',
  path: `${routePrefix}/{id}`,
  request: {
    params: IdUUIDParamsSchema,
    body: jsonContentRequired(systemUsersPatchSchema, '更新系统用户参数'),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(RefineResultSchema(systemUsersDetailResponseSchema), '更新成功'),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(respErrSchema, '请求参数错误'),
    [HttpStatusCodes.CONFLICT]: jsonContent(respErrSchema, '用户名已存在'),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(respErrSchema, '内置用户保护'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(respErrSchema, '用户不存在'),
  },
})

/** Delete system user / 删除系统用户 */
export const remove = createRoute({
  tags,
  summary: '删除系统用户',
  method: 'delete',
  path: `${routePrefix}/{id}`,
  request: {
    params: IdUUIDParamsSchema,
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(RefineResultSchema(IdUUIDParamsSchema), '删除成功'),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(respErrSchema, 'ID参数错误'),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(respErrSchema, '内置用户不允许删除'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(respErrSchema, '用户不存在'),
  },
})
