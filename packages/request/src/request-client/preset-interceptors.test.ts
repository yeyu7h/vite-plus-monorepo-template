import type { AxiosAdapter } from 'axios'

import { AxiosError, AxiosHeaders, CanceledError } from 'axios'
import { describe, expect, it, vi } from 'vite-plus/test'

import { authenticateResponseInterceptor, defaultResponseInterceptor, errorMessageResponseInterceptor } from './preset-interceptors'
import { RequestClient } from './request-client'

describe('preset response interceptors', () => {
  it('refreshes once and replays concurrent 401 requests with the new token', async () => {
    const adapter: AxiosAdapter = async (config) => {
      if (config.headers.get('Authorization') === 'Bearer fresh-token') {
        return {
          config,
          data: { path: config.url },
          headers: new AxiosHeaders(),
          status: 200,
          statusText: 'OK',
        }
      }

      const response = {
        config,
        data: { message: 'unauthorized' },
        headers: new AxiosHeaders(),
        status: 401,
        statusText: 'Unauthorized',
      }
      throw new AxiosError('Request failed with status code 401', AxiosError.ERR_BAD_REQUEST, config, undefined, response)
    }
    const client = new RequestClient({ adapter, responseReturn: 'body' })
    const doReAuthenticate = vi.fn<() => Promise<void>>(async () => undefined)
    const doRefreshToken = vi.fn<() => Promise<string>>(async () => 'fresh-token')
    client.addResponseInterceptor(defaultResponseInterceptor())
    client.addResponseInterceptor(
      authenticateResponseInterceptor({
        client,
        doReAuthenticate,
        doRefreshToken,
        enableRefreshToken: true,
        formatToken: (token) => `Bearer ${token}`,
      }),
    )

    const [first, second] = await Promise.all([client.get('/first'), client.get('/second')])

    expect(first).toEqual({ path: '/first' })
    expect(second).toEqual({ path: '/second' })
    expect(doRefreshToken).toHaveBeenCalledOnce()
    expect(doReAuthenticate).not.toHaveBeenCalled()
    expect(client.isRefreshing).toBe(false)
    expect(client.refreshTokenQueue).toEqual([])
  })

  it('reauthenticates instead of refreshing when refresh is disabled', async () => {
    const adapter: AxiosAdapter = async (config) => {
      const response = {
        config,
        data: { message: 'unauthorized' },
        headers: new AxiosHeaders(),
        status: 401,
        statusText: 'Unauthorized',
      }
      throw new AxiosError('Request failed with status code 401', AxiosError.ERR_BAD_REQUEST, config, undefined, response)
    }
    const client = new RequestClient({ adapter })
    const doReAuthenticate = vi.fn<() => Promise<void>>(async () => undefined)
    const doRefreshToken = vi.fn<() => Promise<string>>(async () => 'unused')
    client.addResponseInterceptor(
      authenticateResponseInterceptor({
        client,
        doReAuthenticate,
        doRefreshToken,
        enableRefreshToken: false,
        formatToken: (token) => token,
      }),
    )

    await expect(client.get('/private')).rejects.toEqual({ message: 'unauthorized' })
    expect(doReAuthenticate).toHaveBeenCalledOnce()
    expect(doRefreshToken).not.toHaveBeenCalled()
  })

  it('retries the original request at most once and reauthenticates when the retry is still unauthorized', async () => {
    let requestCount = 0
    const adapter: AxiosAdapter = async (config) => {
      requestCount += 1
      const response = {
        config,
        data: { message: 'unauthorized' },
        headers: new AxiosHeaders(),
        status: 401,
        statusText: 'Unauthorized',
      }
      throw new AxiosError('Request failed with status code 401', AxiosError.ERR_BAD_REQUEST, config, undefined, response)
    }
    const client = new RequestClient({ adapter })
    const doReAuthenticate = vi.fn<() => Promise<void>>(async () => undefined)
    const doRefreshToken = vi.fn<() => Promise<string>>(async () => 'fresh-token')
    client.addResponseInterceptor(
      authenticateResponseInterceptor({
        client,
        doReAuthenticate,
        doRefreshToken,
        enableRefreshToken: true,
        formatToken: (token) => `Bearer ${token}`,
      }),
    )

    await expect(client.get('/private')).rejects.toEqual({ message: 'unauthorized' })
    expect(requestCount).toBe(2)
    expect(doRefreshToken).toHaveBeenCalledOnce()
    expect(doReAuthenticate).toHaveBeenCalledOnce()
  })

  it('rejects all concurrent requests and reauthenticates once when refresh fails', async () => {
    let releaseRefresh!: () => void
    let markRefreshStarted!: () => void
    const refreshStarted = new Promise<void>((resolve) => {
      markRefreshStarted = resolve
    })
    const refreshGate = new Promise<void>((resolve) => {
      releaseRefresh = resolve
    })
    const refreshError = new Error('refresh failed')
    const adapter: AxiosAdapter = async (config) => {
      const response = {
        config,
        data: { message: 'unauthorized' },
        headers: new AxiosHeaders(),
        status: 401,
        statusText: 'Unauthorized',
      }
      throw new AxiosError('Request failed with status code 401', AxiosError.ERR_BAD_REQUEST, config, undefined, response)
    }
    const client = new RequestClient({ adapter })
    const doReAuthenticate = vi.fn<() => Promise<void>>(async () => undefined)
    const doRefreshToken = vi.fn<() => Promise<string>>(async () => {
      markRefreshStarted()
      await refreshGate
      throw refreshError
    })
    client.addResponseInterceptor(
      authenticateResponseInterceptor({
        client,
        doReAuthenticate,
        doRefreshToken,
        enableRefreshToken: true,
        formatToken: (token) => `Bearer ${token}`,
      }),
    )

    const first = client.get('/first')
    await refreshStarted
    const second = client.get('/second')
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    expect(client.refreshTokenQueue).toHaveLength(1)
    releaseRefresh()

    await expect(first).rejects.toBe(refreshError)
    await expect(second).rejects.toBe(refreshError)
    expect(doRefreshToken).toHaveBeenCalledOnce()
    expect(doReAuthenticate).toHaveBeenCalledOnce()
    expect(client.isRefreshing).toBe(false)
    expect(client.refreshTokenQueue).toEqual([])
  })

  it('maps HTTP errors to a default message callback', async () => {
    const adapter: AxiosAdapter = async (config) => {
      const response = {
        config,
        data: { message: 'missing' },
        headers: new AxiosHeaders(),
        status: 404,
        statusText: 'Not Found',
      }
      throw new AxiosError('Request failed with status code 404', AxiosError.ERR_BAD_REQUEST, config, undefined, response)
    }
    const makeErrorMessage = vi.fn<(message: string, error: unknown) => void>()
    const client = new RequestClient({ adapter })
    client.addResponseInterceptor(errorMessageResponseInterceptor(makeErrorMessage))

    await expect(client.get('/missing')).rejects.toEqual({ message: 'missing' })
    expect(makeErrorMessage).toHaveBeenCalledExactlyOnceWith('The requested resource was not found.', expect.any(AxiosError))
  })

  it('does not emit messages for cancelled requests', async () => {
    const adapter: AxiosAdapter = async () => {
      throw new CanceledError('cancelled')
    }
    const makeErrorMessage = vi.fn<(message: string, error: unknown) => void>()
    const client = new RequestClient({ adapter })
    client.addResponseInterceptor(errorMessageResponseInterceptor(makeErrorMessage))

    await expect(client.get('/cancelled')).rejects.toBeInstanceOf(AxiosError)
    expect(makeErrorMessage).not.toHaveBeenCalled()
  })
})
