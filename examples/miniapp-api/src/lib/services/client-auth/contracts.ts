import { z } from 'zod'

export const clientUserSchema = z.object({
  id: z.uuid(),
  uid: z.string().regex(/^[1-9]\d{8,31}$/),
  nickname: z.string(),
  avatar: z.string().nullable(),
  createdAt: z.string().nullable(),
})
export type ClientUser = z.infer<typeof clientUserSchema>

export const clientSessionSchema = z.object({
  sessionId: z.uuid(),
  userId: z.uuid(),
  appKey: z.string().min(1).max(64),
  expiresAt: z.number().int().positive(),
})
export type ClientSession = z.infer<typeof clientSessionSchema>

export const clientPayloadSchema = z.object({
  sub: z.uuid(),
  sessionId: z.uuid(),
  aud: z.literal('client'),
  iss: z.literal('miniapp-client'),
  iat: z.number().int(),
  exp: z.number().int(),
})

export class ClientAuthError extends Error {
  readonly reason: 'unauthorized' | 'disabled'
  constructor(reason: 'unauthorized' | 'disabled' = 'unauthorized') {
    super(reason === 'disabled' ? '账号已被禁用' : '登录凭证无效或已过期')
    this.name = 'ClientAuthError'
    this.reason = reason
  }
}
