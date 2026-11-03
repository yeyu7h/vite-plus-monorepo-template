import { z } from 'zod'

const appId = z.string().trim().min(1).max(64)

export const miniappAppsSchema = z.record(z.string().regex(/^[\w-]{1,64}$/), z.object({ provider: z.literal('wechat'), appId, appSecret: z.string().trim().min(1) }).strict())
export type MiniappApps = z.infer<typeof miniappAppsSchema>

export const miniappIdentitySchema = z.object({
  provider: z.literal('wechat'),
  appId,
  subjectType: z.literal('open_id'),
  subject: z.string().min(1).max(128),
  unionId: z.string().min(1).max(128).optional(),
})
export type MiniappIdentity = z.infer<typeof miniappIdentitySchema>
