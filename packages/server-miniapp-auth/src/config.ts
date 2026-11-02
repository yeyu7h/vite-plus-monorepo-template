import { z } from 'zod'

const appId = z.string().trim().min(1).max(64)
const secret = z.string().trim().min(1)

export const miniappAppSchema = z.discriminatedUnion('provider', [
  z.object({ provider: z.literal('wechat'), appId, appSecret: secret }).strict(),
  z
    .object({
      provider: z.literal('alipay'),
      appId,
      privateKey: secret,
      alipayPublicKey: secret.optional(),
      appCertContent: secret.optional(),
      alipayPublicCertContent: secret.optional(),
      alipayRootCertContent: secret.optional(),
      keyType: z.enum(['PKCS1', 'PKCS8']).default('PKCS8'),
      sandbox: z.boolean().default(false),
      subjectType: z.enum(['open_id', 'user_id']).default('open_id'),
    })
    .strict()
    .refine(
      (app) => {
        const certificates = [app.appCertContent, app.alipayPublicCertContent, app.alipayRootCertContent]
        return certificates.some(Boolean) ? certificates.every(Boolean) : Boolean(app.alipayPublicKey)
      },
      {
        message: 'Alipay requires a verification public key or a complete certificate configuration',
      },
    ),
])

export const miniappAppsSchema = z.record(z.string().regex(/^[\w-]{1,64}$/), miniappAppSchema)
export type MiniappApp = z.infer<typeof miniappAppSchema>
export type MiniappApps = z.infer<typeof miniappAppsSchema>
export type AlipayApp = Extract<MiniappApp, { provider: 'alipay' }>

export const miniappIdentitySchema = z.object({
  provider: z.enum(['wechat', 'alipay']),
  appId,
  subjectType: z.enum(['open_id', 'user_id']),
  subject: z.string().min(1).max(128),
  unionId: z.string().min(1).max(128).optional(),
})
export type MiniappIdentity = z.infer<typeof miniappIdentitySchema>
