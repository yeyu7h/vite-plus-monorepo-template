import { z } from 'zod'
import { miniappAppsSchema, miniappIdentitySchema } from './config'
import type { MiniappApps, MiniappIdentity } from './config'
import { MiniappAuthError } from './errors'

const wechatResponseSchema = z.object({
  errcode: z.number().optional(),
  openid: z.string().min(1).optional(),
  unionid: z.string().min(1).optional(),
})

/** Exchange a one-use WeChat code for an identity without exposing provider secrets. */
export function createMiniappAuth(options: { apps: MiniappApps; timeoutMs?: number; fetch?: typeof globalThis.fetch }) {
  const apps = miniappAppsSchema.parse(options.apps)
  const timeoutMs = options.timeoutMs ?? 8000
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 30000) throw new RangeError('Invalid provider timeout')
  const fetcher = options.fetch ?? globalThis.fetch

  async function verify(appKey: string, code: string): Promise<MiniappIdentity> {
    const app = Object.hasOwn(apps, appKey) ? apps[appKey] : undefined
    if (!app) throw new MiniappAuthError('APP_NOT_CONFIGURED')
    if (!code || code.length > 1024) throw new MiniappAuthError('INVALID_CODE')

    const url = new URL('https://api.weixin.qq.com/sns/jscode2session')
    url.search = new URLSearchParams({ appid: app.appId, secret: app.appSecret, js_code: code, grant_type: 'authorization_code' }).toString()
    let data: unknown
    try {
      const response = await fetcher(url, { signal: AbortSignal.timeout(timeoutMs), redirect: 'error' })
      if (!response.ok) throw new MiniappAuthError('PROVIDER_UNAVAILABLE')
      data = await response.json()
    } catch {
      throw new MiniappAuthError('PROVIDER_UNAVAILABLE')
    }

    const parsed = wechatResponseSchema.safeParse(data)
    if (!parsed.success) throw new MiniappAuthError('INVALID_PROVIDER_RESPONSE')
    const result = parsed.data
    if (result.errcode) throw new MiniappAuthError([40029, 40163, 40226].includes(result.errcode) ? 'INVALID_CODE' : 'PROVIDER_UNAVAILABLE')
    const identity = miniappIdentitySchema.safeParse({ provider: app.provider, appId: app.appId, subjectType: 'open_id', subject: result.openid, unionId: result.unionid })
    if (!identity.success) throw new MiniappAuthError('INVALID_PROVIDER_RESPONSE')
    return identity.data
  }

  return { verify }
}
