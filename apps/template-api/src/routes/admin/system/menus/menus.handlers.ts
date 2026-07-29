import { HttpStatusCodes } from '@monorepo/server-core'
import { Resp } from '@/utils'

import { createSystemMenu, deleteSystemMenu, getAllMenuNodes, MenuConflictError, updateSystemMenu } from './menus.helpers'
import type { MenuRouteHandlerType } from './menus.types'

export const tree: MenuRouteHandlerType<'tree'> = async (c) => {
  const menus = await getAllMenuNodes()
  return c.json(Resp.ok(menus), HttpStatusCodes.OK)
}

export const create: MenuRouteHandlerType<'create'> = async (c) => {
  const body = c.req.valid('json')
  const { sub } = c.get('jwtPayload')
  if (body.parentId) return c.json(Resp.fail('顶级菜单不能设置父菜单，请使用新增下级接口'), HttpStatusCodes.CONFLICT)

  try {
    const created = await createSystemMenu({ ...body, parentId: null }, sub)
    return c.json(Resp.ok(created), HttpStatusCodes.CREATED)
  } catch (error) {
    if (error instanceof MenuConflictError) return c.json(Resp.fail(error.message), HttpStatusCodes.CONFLICT)
    throw error
  }
}

export const createChild: MenuRouteHandlerType<'createChild'> = async (c) => {
  const { id } = c.req.valid('param')
  const body = c.req.valid('json')
  const { sub } = c.get('jwtPayload')

  try {
    const created = await createSystemMenu({ ...body, parentId: id, groupId: null }, sub)
    return c.json(Resp.ok(created), HttpStatusCodes.CREATED)
  } catch (error) {
    if (error instanceof MenuConflictError) {
      const status = error.message === '父菜单不存在' ? HttpStatusCodes.NOT_FOUND : HttpStatusCodes.CONFLICT
      return c.json(Resp.fail(error.message), status)
    }
    throw error
  }
}

export const update: MenuRouteHandlerType<'update'> = async (c) => {
  const { id } = c.req.valid('param')
  const body = c.req.valid('json')
  const { sub } = c.get('jwtPayload')

  try {
    const updated = await updateSystemMenu(id, body, sub)
    if (!updated) return c.json(Resp.fail('菜单不存在'), HttpStatusCodes.NOT_FOUND)
    return c.json(Resp.ok(updated), HttpStatusCodes.OK)
  } catch (error) {
    if (error instanceof MenuConflictError) return c.json(Resp.fail(error.message), HttpStatusCodes.CONFLICT)
    throw error
  }
}

export const remove: MenuRouteHandlerType<'remove'> = async (c) => {
  const { id } = c.req.valid('param')
  try {
    const deleted = await deleteSystemMenu(id)
    if (!deleted) return c.json(Resp.fail('菜单不存在'), HttpStatusCodes.NOT_FOUND)
    return c.json(Resp.ok(deleted), HttpStatusCodes.OK)
  } catch (error) {
    if (error instanceof MenuConflictError) return c.json(Resp.fail(error.message), HttpStatusCodes.CONFLICT)
    throw error
  }
}
