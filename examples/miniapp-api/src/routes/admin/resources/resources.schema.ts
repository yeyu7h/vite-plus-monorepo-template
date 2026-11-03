import { z } from '@hono/zod-openapi'
import { objectKeySchema } from '@/lib/services/object-storage/object-key'

export const uploadTokenRequestSchema = z
  .object({
    fileName: objectKeySchema.meta({ description: '对象文件路径，例如 avatars/default/example.png' }),
    fileType: z.string().optional().meta({ description: '文件类型' }),
  })
  .strict()

export const downloadTokenRequestSchema = z
  .object({
    fileName: objectKeySchema.meta({ description: '对象文件路径' }),
  })
  .strict()

export const tokenResponseSchema = z.object({
  url: z.string().meta({ description: '预签名 URL' }),
  expiresAt: z.string().meta({ description: '过期时间' }),
})
