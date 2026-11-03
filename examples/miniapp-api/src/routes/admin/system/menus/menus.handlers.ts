import type { MenusRouteHandler } from './menus.types'

import { eq } from 'drizzle-orm'

import db from '@/db'
import { systemMenuRoles, systemMenus } from '@/db/schema'
import { HttpStatusCodes } from '@monorepo/server-core'
import { Resp } from '@/utils'

import { buildMenuTree, deleteMenuSubtree, loadMenuNode, loadMenuRows, MenuValidationError, validateMenuWrite } from './menus.helpers'

export const tree: MenusRouteHandler<'tree'> = async (c) => c.json(Resp.ok(buildMenuTree(await loadMenuRows())), HttpStatusCodes.OK)

export const create: MenusRouteHandler<'create'> = async (c) => {
  const body = c.req.valid('json')
  const { sub } = c.get('jwtPayload')
  const { accessScope: requestedAccessScope, ...menu } = body
  const accessScope = menu.type === 'group' ? 'public' : (requestedAccessScope ?? 'restricted')

  try {
    await validateMenuWrite({ ...menu, accessScope })
  } catch (error) {
    const validation = getValidationError(error)
    return c.json(Resp.fail(validation.message), validation.status)
  }

  await db.transaction(async (tx) => {
    await tx.insert(systemMenus).values({ ...menu, createdBy: sub })
    if (menu.type !== 'group' && accessScope === 'restricted') await tx.insert(systemMenuRoles).values({ menuId: menu.id, roleId: 'admin' })
  })

  return c.json(Resp.ok((await loadMenuNode(menu.id))!), HttpStatusCodes.CREATED)
}

export const update: MenusRouteHandler<'update'> = async (c) => {
  const { id } = c.req.valid('param')
  const body = c.req.valid('json')
  const { sub } = c.get('jwtPayload')
  const existing = await loadMenuNode(id)
  if (!existing) return c.json(Resp.fail('菜单节点不存在'), HttpStatusCodes.NOT_FOUND)

  const nextType = body.type ?? existing.type
  const accessScope = nextType === 'group' ? 'public' : (body.accessScope ?? existing.accessScope)
  const { accessScope: _scope, roleIds: _roles, children: _children, ...existingRow } = existing
  const { accessScope: _requestedScope, ...changes } = body
  const prospective = { ...existingRow, ...changes, id, accessScope }

  try {
    await validateMenuWrite(prospective, id)
  } catch (error) {
    const validation = getValidationError(error)
    return c.json(Resp.fail(validation.message), validation.status)
  }

  await db.transaction(async (tx) => {
    if (Object.keys(changes).length > 0)
      await tx
        .update(systemMenus)
        .set({ ...changes, updatedBy: sub })
        .where(eq(systemMenus.id, id))
    if (nextType === 'group' || body.accessScope === 'public') await tx.delete(systemMenuRoles).where(eq(systemMenuRoles.menuId, id))
    if (body.accessScope === 'restricted') await tx.insert(systemMenuRoles).values({ menuId: id, roleId: 'admin' }).onConflictDoNothing()
  })

  return c.json(Resp.ok((await loadMenuNode(id))!), HttpStatusCodes.OK)
}

export const remove: MenusRouteHandler<'remove'> = async (c) => {
  const { id } = c.req.valid('param')
  let deletedCount: number | null
  try {
    deletedCount = await deleteMenuSubtree(id)
  } catch (error) {
    const validation = getValidationError(error)
    return c.json(Resp.fail(validation.message), validation.status)
  }
  if (deletedCount === null) return c.json(Resp.fail('菜单节点不存在'), HttpStatusCodes.NOT_FOUND)
  return c.json(Resp.ok({ id, deletedCount }), HttpStatusCodes.OK)
}

function getValidationError(error: unknown) {
  if (error instanceof MenuValidationError) {
    return { message: error.message, status: error.kind === 'conflict' ? HttpStatusCodes.CONFLICT : HttpStatusCodes.BAD_REQUEST } as const
  }
  throw error
}
