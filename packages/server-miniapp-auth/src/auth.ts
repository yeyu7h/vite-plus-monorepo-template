import { AlipaySdk } from 'alipay-sdk'
import { z } from 'zod'
import { miniappAppsSchema, miniappIdentitySchema } from './config'
import type { AlipayApp, MiniappApps, MiniappIdentity } from './config'
import { MiniappAuthError } from './errors'

const wechatResponseSchema = z.object({
  errcode: z.number().optional(),
  openid: z.string().min(1).optional(),
  unionid: z.string().min(1).optional(),
})
const alipayResponseSchema = z.object({
  code: z.string().optional(),
  sub_code: z.string().optional(),
  open_id: z.string().min(1).optional(),
  user_id: z.string().min(1).optional(),
  access_token: z.string().min(1).optional(),
})
const alipayErrorResponseSchema = z.object({ error_response: alipayResponseSchema }).catchall(z.unknown())
const invalidAlipayCodes = new Set(['isv.code-invalid', 'isv.code-expired', 'isv.invalid-auth-code', 'isv.auth-code-invalid'])

function isInvalidAlipayCode(response: z.infer<typeof alipayResponseSchema>): boolean {
  return !!response.code && response.code !== '10000' && invalidAlipayCodes.has(response.sub_code ?? '')
}

class MiniappAlipaySdk extends AlipaySdk {
  override checkResponseSign(...args: Parameters<AlipaySdk['checkResponseSign']>): void {
    const [raw, responseKey] = args
    const parsed = alipayErrorResponseSchema.safeParse(JSON.parse(raw))
    // Rejected OAuth codes may use an unsigned error_response. Only classify failures;
    // successful OAuth responses must still pass the SDK's signature verification.
    if (parsed.success && parsed.data[responseKey] == null && isInvalidAlipayCode(parsed.data.error_response)) throw new MiniappAuthError('INVALID_CODE')
    super.checkResponseSign(...args)
  }
}

export interface AlipayTokenClient {
  exchange(code: string): Promise<unknown>
}

export type MiniappAuthOptions = {
  apps: MiniappApps
  timeoutMs?: number
  fetch?: typeof globalThis.fetch
  createAlipayClient?: (app: AlipayApp, timeoutMs: number) => AlipayTokenClient
}

/** SDK validates signatures before returning the OAuth response. */
export function createAlipayTokenClient(app: AlipayApp, timeoutMs: number): AlipayTokenClient {
  const sdk = new MiniappAlipaySdk({
    appId: app.appId,
    privateKey: app.privateKey,
    alipayPublicKey: app.alipayPublicKey,
    appCertContent: app.appCertContent,
    alipayPublicCertContent: app.alipayPublicCertContent,
    alipayRootCertContent: app.alipayRootCertContent,
    keyType: app.keyType,
    signType: 'RSA2',
    camelcase: false,
    timeout: timeoutMs,
    gateway: app.sandbox ? 'https://openapi-sandbox.dl.alipaydev.com/gateway.do' : 'https://openapi.alipay.com/gateway.do',
  })
  return {
    exchange: (code) => sdk.exec('alipay.system.oauth.token', { grantType: 'authorization_code', code }, { validateSign: true }),
  }
}

/** Only returns an identity verified by the provider. Platform tokens and secrets stay inside the adapter. */
export function createMiniappAuth(options: MiniappAuthOptions) {
  const apps = miniappAppsSchema.parse(options.apps)
  const timeoutMs = options.timeoutMs ?? 8000
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 30000) throw new RangeError('Invalid provider timeout')
  const fetcher = options.fetch ?? globalThis.fetch
  const alipayClients = new Map<string, AlipayTokenClient>()

  async function verify(appKey: string, code: string): Promise<MiniappIdentity> {
    const app = Object.hasOwn(apps, appKey) ? apps[appKey] : undefined
    if (!app) throw new MiniappAuthError('APP_NOT_CONFIGURED')
    if (!code || code.length > 1024) throw new MiniappAuthError('INVALID_CODE')

    let identity: unknown
    if (app.provider === 'wechat') {
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
      if (result.errcode) {
        throw new MiniappAuthError([40029, 40163, 40226].includes(result.errcode) ? 'INVALID_CODE' : 'PROVIDER_UNAVAILABLE')
      }
      identity = { provider: app.provider, appId: app.appId, subjectType: 'open_id', subject: result.openid, unionId: result.unionid }
    } else {
      let data: unknown
      try {
        let client = alipayClients.get(appKey)
        if (!client) {
          client = (options.createAlipayClient ?? createAlipayTokenClient)(app, timeoutMs)
          alipayClients.set(appKey, client)
        }
        data = await client.exchange(code)
      } catch (error) {
        throw new MiniappAuthError(error instanceof MiniappAuthError && error.code === 'INVALID_CODE' ? 'INVALID_CODE' : 'PROVIDER_UNAVAILABLE')
      }
      const parsed = alipayResponseSchema.safeParse(data)
      if (!parsed.success) throw new MiniappAuthError('INVALID_PROVIDER_RESPONSE')
      const result = parsed.data
      if (result.code && result.code !== '10000') {
        throw new MiniappAuthError(isInvalidAlipayCode(result) ? 'INVALID_CODE' : 'PROVIDER_UNAVAILABLE')
      }
      if (!result.access_token) throw new MiniappAuthError('INVALID_PROVIDER_RESPONSE')
      identity = { provider: app.provider, appId: app.appId, subjectType: app.subjectType, subject: result[app.subjectType] }
    }
    const parsed = miniappIdentitySchema.safeParse(identity)
    if (!parsed.success) throw new MiniappAuthError('INVALID_PROVIDER_RESPONSE')
    return parsed.data
  }

  return { verify }
}
