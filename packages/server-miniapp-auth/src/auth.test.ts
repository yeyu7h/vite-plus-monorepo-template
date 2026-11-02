import { createSign, generateKeyPairSync } from 'node:crypto'
import { createServer } from 'node:http'
import { AlipaySdk } from 'alipay-sdk'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { createMiniappAuth, createAlipayTokenClient } from './auth'
import { miniappAppsSchema } from './config'
import { MiniappAuthError } from './errors'

afterEach(() => vi.restoreAllMocks())
const wxApps = miniappAppsSchema.parse({ wx: { provider: 'wechat', appId: 'wx-123', appSecret: 'never-return-this' } })
const aliApps = miniappAppsSchema.parse({ ali: { provider: 'alipay', appId: 'ali-123', privateKey: 'private-secret', alipayPublicKey: 'verification-key' } })
const sdkKeys = generateKeyPairSync('rsa', { modulusLength: 2048 })
const sdkApps = miniappAppsSchema.parse({
  ali: {
    ...aliApps.ali,
    privateKey: sdkKeys.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    alipayPublicKey: sdkKeys.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  },
})

/** Redirect transport locally while exercising the SDK's real parsing and signature verification. */
async function withAlipaySdkResponse(body: string, check: (auth: ReturnType<typeof createMiniappAuth>) => Promise<void>) {
  const server = createServer((request, response) => {
    request.resume()
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(body)
  })
  await new Promise<void>((resolve, reject) => server.listen(0, '127.0.0.1', resolve).once('error', reject))
  try {
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Expected a local TCP address')
    const gateway = `http://127.0.0.1:${address.port}/gateway.do`
    // oxlint-disable-next-line typescript/unbound-method -- Invoked below with .call on the actual SDK instance.
    const originalExec = AlipaySdk.prototype.exec
    const exec = vi.spyOn(AlipaySdk.prototype, 'exec').mockImplementation(function (this: AlipaySdk, ...args) {
      this.config.gateway = gateway
      return originalExec.call(this, ...args)
    })
    await check(createMiniappAuth({ apps: sdkApps }))
    expect(exec).toHaveBeenCalledTimes(1)
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
  }
}

describe('verified mini program identities', () => {
  it('exchanges a WeChat code server-side and removes all platform secrets from the result', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ openid: 'wx-user', unionid: 'union-1', session_key: 'session-secret' }))
    const result = await createMiniappAuth({ apps: wxApps, fetch: fetcher }).verify('wx', 'login-code')
    expect(result).toEqual({ provider: 'wechat', appId: 'wx-123', subjectType: 'open_id', subject: 'wx-user', unionId: 'union-1' })
    const requested = fetcher.mock.calls[0]![0]
    if (!(requested instanceof URL)) throw new Error('Expected a URL request')
    const url = requested
    expect(url.origin).toBe('https://api.weixin.qq.com')
    expect(Object.fromEntries(url.searchParams)).toEqual({ appid: 'wx-123', secret: 'never-return-this', js_code: 'login-code', grant_type: 'authorization_code' })
    expect(fetcher.mock.calls[0]![1]?.redirect).toBe('error')
  })

  it.each(['missing', '__proto__', 'constructor'])('rejects unknown app key %s before making a request', async (appKey) => {
    const fetcher = vi.fn<typeof fetch>()
    await expect(createMiniappAuth({ apps: wxApps, fetch: fetcher }).verify(appKey, 'code')).rejects.toMatchObject({ code: 'APP_NOT_CONFIGURED' })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it.each([40029, 40163, 40226])('rejects WeChat credential error %s even if an openid is present', async (errcode) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ errcode, openid: 'untrusted' }))
    await expect(createMiniappAuth({ apps: wxApps, fetch: fetcher }).verify('wx', 'code')).rejects.toMatchObject({ code: 'INVALID_CODE' })
  })

  it('fails closed on a response without a user identifier', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ session_key: 'secret' }))
    await expect(createMiniappAuth({ apps: wxApps, fetch: fetcher }).verify('wx', 'code')).rejects.toMatchObject({ code: 'INVALID_PROVIDER_RESPONSE' })
  })

  it('redacts network errors which contain the credential URL', async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error('secret=never-return-this&js_code=login-code'))
    await expect(createMiniappAuth({ apps: wxApps, fetch: fetcher }).verify('wx', 'code')).rejects.toEqual(new MiniappAuthError('PROVIDER_UNAVAILABLE'))
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('normalizes Alipay open_id and discards OAuth access and refresh tokens', async () => {
    const exchange = vi.fn<(code: string) => Promise<unknown>>().mockResolvedValue({ open_id: 'ali-user', user_id: 'legacy-user', access_token: 'secret', refresh_token: 'other-secret' })
    const auth = createMiniappAuth({ apps: aliApps, createAlipayClient: () => ({ exchange }) })
    expect(await auth.verify('ali', 'auth-code')).toEqual({ provider: 'alipay', appId: 'ali-123', subjectType: 'open_id', subject: 'ali-user' })
    expect(exchange).toHaveBeenCalledExactlyOnceWith('auth-code')
  })

  it('does not silently change the identity namespace when Alipay returns only a legacy user_id', async () => {
    const auth = createMiniappAuth({ apps: aliApps, createAlipayClient: () => ({ exchange: async () => ({ user_id: 'legacy', access_token: 'secret' }) }) })
    await expect(auth.verify('ali', 'code')).rejects.toMatchObject({ code: 'INVALID_PROVIDER_RESPONSE' })
  })

  it('supports legacy user_id only when configured explicitly', async () => {
    const apps = miniappAppsSchema.parse({ ali: { ...aliApps.ali, subjectType: 'user_id' } })
    const auth = createMiniappAuth({ apps, createAlipayClient: () => ({ exchange: async () => ({ user_id: 'legacy', access_token: 'secret' }) }) })
    expect(await auth.verify('ali', 'code')).toMatchObject({ subjectType: 'user_id', subject: 'legacy' })
  })

  it('sanitizes signature validation failures without returning or logging the raw SDK error', async () => {
    const auth = createMiniappAuth({
      apps: aliApps,
      createAlipayClient: () => ({
        exchange: async () => {
          throw new Error('signature invalid: raw access_token=secret')
        },
      }),
    })
    await expect(auth.verify('ali', 'code')).rejects.toEqual(new MiniappAuthError('PROVIDER_UNAVAILABLE'))
  })

  it.each(['isv.code-invalid', 'isv.code-expired', 'isv.invalid-auth-code', 'isv.auth-code-invalid'])('classifies unsigned Alipay SDK error_response %s as an invalid code', async (subCode) => {
    const body = JSON.stringify({ error_response: { code: '40002', sub_code: subCode, sub_msg: 'raw code=one-use-code access_token=secret', open_id: 'untrusted', access_token: 'secret' } })
    await withAlipaySdkResponse(body, async (auth) => {
      await expect(auth.verify('ali', 'one-use-code')).rejects.toEqual(new MiniappAuthError('INVALID_CODE'))
    })
  })

  it.each([
    ['unknown provider error', JSON.stringify({ error_response: { code: '40002', sub_code: 'isv.invalid-signature' } })],
    ['a success code in error_response', JSON.stringify({ error_response: { code: '10000', sub_code: 'isv.code-invalid', open_id: 'untrusted', access_token: 'secret' } })],
    ['unsigned success', JSON.stringify({ alipay_system_oauth_token_response: { open_id: 'untrusted', access_token: 'secret' } })],
    ['invalid signature', JSON.stringify({ alipay_system_oauth_token_response: { open_id: 'untrusted', access_token: 'secret' }, sign: 'invalid-signature' })],
    [
      'an error_response alongside unsigned success',
      JSON.stringify({ alipay_system_oauth_token_response: { open_id: 'untrusted', access_token: 'secret' }, error_response: { code: '40002', sub_code: 'isv.code-invalid' } }),
    ],
    ['malformed JSON', '{invalid-json'],
  ])('keeps %s as an unavailable provider through the real Alipay SDK', async (_description, body) => {
    await withAlipaySdkResponse(body, async (auth) => {
      await expect(auth.verify('ali', 'one-use-code')).rejects.toEqual(new MiniappAuthError('PROVIDER_UNAVAILABLE'))
    })
  })

  it('accepts a successfully signed OAuth response through the real Alipay SDK', async () => {
    const data = JSON.stringify({ open_id: 'ali-user', access_token: 'secret', refresh_token: 'other-secret' })
    const signature = createSign('RSA-SHA256').update(data).sign(sdkKeys.privateKey, 'base64')
    await withAlipaySdkResponse(`{"alipay_system_oauth_token_response":${data},"sign":${JSON.stringify(signature)}}`, async (auth) => {
      await expect(auth.verify('ali', 'one-use-code')).resolves.toEqual({ provider: 'alipay', appId: 'ali-123', subjectType: 'open_id', subject: 'ali-user' })
    })
  })

  it('requires signature verification in the official SDK and supplies OAuth parameters outside bizContent', async () => {
    const keys = generateKeyPairSync('rsa', { modulusLength: 2048 })
    const app = {
      ...aliApps.ali,
      provider: 'alipay' as const,
      privateKey: keys.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
      alipayPublicKey: keys.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    }
    const parsed = miniappAppsSchema.parse({ ali: app }).ali
    if (parsed.provider !== 'alipay') throw new Error('Invalid test setup')
    const exec = vi.spyOn(AlipaySdk.prototype, 'exec').mockResolvedValue({ code: '10000', msg: 'Success', open_id: 'ali-user', access_token: 'secret' })
    await createAlipayTokenClient(parsed, 8000).exchange('one-use-code')
    expect(exec).toHaveBeenCalledExactlyOnceWith('alipay.system.oauth.token', { grantType: 'authorization_code', code: 'one-use-code' }, { validateSign: true })
  })

  it('refuses Alipay configuration without a verification key or complete certificate bundle', () => {
    expect(miniappAppsSchema.safeParse({ ali: { provider: 'alipay', appId: '123', privateKey: 'secret' } }).success).toBe(false)
  })
})
