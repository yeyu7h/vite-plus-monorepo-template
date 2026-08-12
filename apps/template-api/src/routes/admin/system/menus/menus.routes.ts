import { createRoute } from '@hono/zod-openapi'

import { RefineResultSchema } from '@/lib/core/refine-query'
import { HttpStatusCodes, jsonContent, jsonContentRequired } from '@monorepo/server-core'
import { respErrSchema } from '@/utils'

import { menuCreateSchema, menuDeleteResponseSchema, menuIdParamsSchema, menuPatchSchema, menuTreeNodeSchema, menuTreeResponseSchema } from './menus.schema'

const routePrefix = '/system/menus'
const tags = [`${routePrefix}（菜单管理）`]

export const tree = createRoute({
  tags,
  summary: '获取递归菜单管理树',
  method: 'get',
  path: `${routePrefix}/tree`,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(RefineResultSchema(menuTreeResponseSchema), '获取成功'),
  },
})

export const create = createRoute({
  tags,
  summary: '创建菜单节点',
  method: 'post',
  path: routePrefix,
  request: { body: jsonContentRequired(menuCreateSchema, '创建菜单节点参数') },
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(RefineResultSchema(menuTreeNodeSchema), '创建成功'),
    [HttpStatusCodes.CONFLICT]: jsonContent(respErrSchema, 'ID、同级路径或权限码冲突'),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(respErrSchema, '菜单层级或访问范围无效'),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(respErrSchema, '参数验证失败'),
  },
})

export const update = createRoute({
  tags,
  summary: '更新菜单节点',
  method: 'patch',
  path: `${routePrefix}/{id}`,
  request: { params: menuIdParamsSchema, body: jsonContentRequired(menuPatchSchema, '更新菜单节点参数') },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(RefineResultSchema(menuTreeNodeSchema), '更新成功'),
    [HttpStatusCodes.CONFLICT]: jsonContent(respErrSchema, '同级路径或权限码冲突'),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(respErrSchema, '菜单层级或访问范围无效'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(respErrSchema, '菜单节点不存在'),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(respErrSchema, '参数验证失败'),
  },
})

export const remove = createRoute({
  tags,
  summary: '级联删除菜单子树',
  method: 'delete',
  path: `${routePrefix}/{id}`,
  request: { params: menuIdParamsSchema },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(RefineResultSchema(menuDeleteResponseSchema), '删除成功'),
    [HttpStatusCodes.CONFLICT]: jsonContent(respErrSchema, '非空菜单分组不能删除'),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(respErrSchema, '菜单节点状态无效'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(respErrSchema, '菜单节点不存在'),
  },
})
