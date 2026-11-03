import { z } from 'zod'
import { clientUserSchema } from '@/lib/services/client-auth/contracts'

export const miniappLoginSchema = z
  .object({
    appKey: z
      .string()
      .regex(/^[\w-]{1,64}$/)
      .meta({ description: '服务端配置的小程序应用标识，如 wechat-main、alipay-main' }),
    code: z.string().trim().min(1).max(1024).meta({ description: 'wx.login 的 code 或 my.getAuthCode 的 authCode' }),
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
