import type { BaseBindings } from './types.ts'
import { OpenAPIHono } from '@hono/zod-openapi'
import { defaultHook } from './openapi/index.ts'

export function createRouter<TBindings extends BaseBindings = BaseBindings>() {
  return new OpenAPIHono<TBindings>({
    strict: false,
    defaultHook,
  })
}

export const createTierRouter = createRouter

export function createAdminRouter() {
  return createTierRouter<import('./types.ts').AdminBindings>()
}

export function createClientRouter() {
  return createTierRouter<import('./types.ts').ClientBindings>()
}

export function createPublicRouter() {
  return createTierRouter<import('./types.ts').PublicBindings>()
}
