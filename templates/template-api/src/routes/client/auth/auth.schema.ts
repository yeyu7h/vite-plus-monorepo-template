import { z } from 'zod'
import { clientUserSchema } from '@/lib/services/client-auth/contracts'

export const miniappLoginSchema = z
  .object({
    appKey: z
      .string()
      .regex(/^[\w-]{1,64}$/)
      .meta({ description: '服务端配置的微信小程序应用标识，如 wechat-main' }),
    code: z.string().trim().min(1).max(1024).meta({ description: 'wx.login 获取的一次性 code' }),
  })
  .strict()

export const refreshSchema = z.object({ refreshToken: z.string().min(1).max(128) }).strict()
export const tokenPairSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number().int().positive(),
  refreshExpiresIn: z.number().int().positive(),
})
export const loginResultSchema = tokenPairSchema.extend({ user: clientUserSchema, isNewUser: z.boolean() })
