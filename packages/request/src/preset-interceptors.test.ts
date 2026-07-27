import type { AxiosResponse } from 'axios'

import MockAdapter from 'axios-mock-adapter'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { authenticateResponseInterceptor, defaultResponseInterceptor } from './preset-interceptors.ts'
import { RequestClient } from './request-client.ts'

describe('request preset interceptors', () => {
  let client: RequestClient
  let mock: MockAdapter

  beforeEach(() => {
    client = new RequestClient({ responseReturn: 'data' })
    mock = new MockAdapter(client.getAxiosInstance())
  })

  afterEach(() => {
    mock.restore()
  })

  it('returns the data field for a successful business response', async () => {
    client.addResponseInterceptor(defaultResponseInterceptor())
    mock.onGet('/profile').reply(200, { code: 0, data: { id: 'user-1' }, message: 'ok' })

    await expect(client.get<{ id: string }>('/profile')).resolves.toEqual({ id: 'user-1' })
  })

  it('honors raw and body response modes', async () => {
    client.addResponseInterceptor(defaultResponseInterceptor())
    mock.onGet('/profile').reply(200, { code: 0, data: { id: 'user-1' }, message: 'ok' })

    const raw = await client.get<AxiosResponse>('/profile', { responseReturn: 'raw' })
    const body = await client.get('/profile', { responseReturn: 'body' })

    expect(raw.data).toMatchObject({ code: 0 })
    expect(body).toEqual({ code: 0, data: { id: 'user-1' }, message: 'ok' })
  })

  it('refreshes the token once and retries queued 401 requests', async () => {
    const refreshToken = vi.fn<() => Promise<string>>().mockResolvedValue('next-token')
    const reAuthenticate = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)

    client.addResponseInterceptor(
      authenticateResponseInterceptor({
        client,
        doReAuthenticate: reAuthenticate,
        doRefreshToken: refreshToken,
        enableRefreshToken: true,
        formatToken: (token) => (token ? `Bearer ${token}` : null),
      }),
    )
    mock.onGet('/protected').replyOnce(401)
    mock.onGet('/protected').replyOnce(401)
    mock.onGet('/protected').reply(200, { ok: true })

    const responses = await Promise.all([client.get<AxiosResponse<{ ok: boolean }>>('/protected'), client.get<AxiosResponse<{ ok: boolean }>>('/protected')])

    expect(responses.map((response) => response.data.ok)).toEqual([true, true])
    expect(refreshToken).toHaveBeenCalledTimes(1)
    expect(reAuthenticate).not.toHaveBeenCalled()
  })
})
