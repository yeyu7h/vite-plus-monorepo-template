import { z } from '@hono/zod-openapi'

export const cacheCategorySchema = z.enum(['dict', 'param', 'ip'])
export const cacheQuerySchema = z.object({ category: cacheCategorySchema, cursor: z.string().regex(/^\d+$/).default('0') })
export const cacheKeyParamsSchema = z.object({ key: z.string().min(1).max(256) })
export const clearCacheSchema = z.object({ category: cacheCategorySchema, cursor: z.string().regex(/^\d+$/).default('0') })
export const cacheItemSchema = z.object({ key: z.string(), category: cacheCategorySchema, ttlSeconds: z.number(), preview: z.string(), truncated: z.boolean() })
export const cacheListSchema = z.object({ items: z.array(cacheItemSchema), cursor: z.string(), hasMore: z.boolean() })
export const cacheClearSchema = z.object({ deleted: z.number(), complete: z.boolean(), cursor: z.string() })
