import { describe, expect, it, vi } from 'vite-plus/test'
import { createMiniappAuth } from './index'
import { miniappAppsSchema } from './config'
import { MiniappAuthError } from './errors'

const apps = miniappAppsSchema.parse({ wx: { provider: 'wechat', appId: 'wx-123', appSecret: 'never-return-this' } })

describe('WeChat mini program identity verification', () => {
  it('exchanges a one-use code and returns the verified identity without provider secrets', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ openid: 'wx-user', unionid: 'union-1', session_key: 'session-secret' }))
    const result = await createMiniappAuth({ apps, fetch: fetcher }).verify('wx', 'login-code')
    expect(result).toEqual({ provider: 'wechat', appId: 'wx-123', subjectType: 'open_id', subject: 'wx-user', unionId: 'union-1' })
    const requested = fetcher.mock.calls[0]![0]
    if (!(requested instanceof URL)) throw new Error('Expected a URL request')
    expect(requested.origin).toBe('https://api.weixin.qq.com')
    expect(Object.fromEntries(requested.searchParams)).toEqual({ appid: 'wx-123', secret: 'never-return-this', js_code: 'login-code', grant_type: 'authorization_code' })
    expect(fetcher.mock.calls[0]![1]?.redirect).toBe('error')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it.each(['missing', '__proto__', 'constructor'])('rejects unknown app key %s before making a request', async (appKey) => {
    const fetcher = vi.fn<typeof fetch>()
    await expect(createMiniappAuth({ apps, fetch: fetcher }).verify(appKey, 'code')).rejects.toMatchObject({ code: 'APP_NOT_CONFIGURED' })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it.each([40029, 40163, 40226])('rejects invalid WeChat code %s even when a user identifier is present', async (errcode) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ errcode, openid: 'untrusted' }))
    await expect(createMiniappAuth({ apps, fetch: fetcher }).verify('wx', 'code')).rejects.toMatchObject({ code: 'INVALID_CODE' })
  })

  it('fails closed when the provider response has no user identifier', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ session_key: 'secret' }))
    await expect(createMiniappAuth({ apps, fetch: fetcher }).verify('wx', 'code')).rejects.toMatchObject({ code: 'INVALID_PROVIDER_RESPONSE' })
  })

  it('does not expose secrets from network failures or retry the code', async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error('secret=never-return-this&js_code=login-code'))
    await expect(createMiniappAuth({ apps, fetch: fetcher }).verify('wx', 'code')).rejects.toEqual(new MiniappAuthError('PROVIDER_UNAVAILABLE'))
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})
