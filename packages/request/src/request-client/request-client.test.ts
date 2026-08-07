import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios'

import axios, { AxiosError, AxiosHeaders } from 'axios'
import { describe, expect, it, vi } from 'vite-plus/test'

import { defaultResponseInterceptor } from './preset-interceptors'
import { RequestClient } from './request-client'

function createResponse<T>(config: InternalAxiosRequestConfig, data: T, status = 200): AxiosResponse<T> {
  return {
    config,
    data,
    headers: new AxiosHeaders(),
    status,
    statusText: status >= 200 && status < 400 ? 'OK' : 'Error',
  }
}

describe('RequestClient', () => {
  it('uses the expected defaults and supports all HTTP helpers', async () => {
    const requests: InternalAxiosRequestConfig[] = []
    const adapter: AxiosAdapter = async (config) => {
      requests.push(config)
      return createResponse(config, { method: config.method })
    }
    const client = new RequestClient({ adapter })
    // oxlint-disable-next-line typescript/unbound-method -- RequestClient intentionally binds its public methods at construction time.
    const { get } = client

    const getResponse = await get<AxiosResponse<{ method: string }>>('/get')
    await client.post('/post', { value: 1 })
    await client.patch('/patch', { value: 2 })
    await client.put('/put', { value: 3 })
    await client.delete('/delete')

    expect(getResponse.data).toEqual({ method: 'get' })
    expect(requests.map(({ method }) => method)).toEqual(['get', 'post', 'patch', 'put', 'delete'])
    expect(requests[2]?.data).toBe('{"value":2}')
    expect(requests[0]?.timeout).toBe(10_000)
    expect(requests[0]?.headers.getContentType()).toBe('application/json;charset=utf-8')
  })

  it('registers request interceptors', async () => {
    const adapter = vi.fn<AxiosAdapter>(async (config) => createResponse(config, config.headers.get('X-Request-Id')))
    const client = new RequestClient({ adapter })
    client.addRequestInterceptor({
      fulfilled: (config) => {
        config.headers.set('X-Request-Id', 'request-1')
        return config
      },
    })

    const response = await client.get<AxiosResponse<string>>('/intercepted')

    expect(response.data).toBe('request-1')
    expect(adapter).toHaveBeenCalledOnce()
  })

  it('supports raw, body, and business-data response modes', async () => {
    const adapter: AxiosAdapter = async (config) => createResponse(config, { code: 0, data: { id: 1 }, message: 'ok' })
    const client = new RequestClient({ adapter, responseReturn: 'data' })
    client.addResponseInterceptor(defaultResponseInterceptor())

    await expect(client.get<{ id: number }>('/data')).resolves.toEqual({ id: 1 })
    await expect(client.get('/body', { responseReturn: 'body' })).resolves.toEqual({ code: 0, data: { id: 1 }, message: 'ok' })

    const raw = await client.get<AxiosResponse>('/raw', { responseReturn: 'raw' })
    expect(raw.status).toBe(200)
    expect(raw.data).toEqual({ code: 0, data: { id: 1 }, message: 'ok' })
  })

  it('unwraps successful responses that omit the business code', async () => {
    const adapter: AxiosAdapter = async (config) => createResponse(config, { data: { id: 1 } })
    const client = new RequestClient({ adapter, responseReturn: 'data' })
    client.addResponseInterceptor(defaultResponseInterceptor())

    await expect(client.get<{ id: number }>('/data-without-code')).resolves.toEqual({ id: 1 })
  })

  it('rejects with the backend response body when the business code fails', async () => {
    const body = { code: 5001, data: null, message: 'failed' }
    const adapter: AxiosAdapter = async (config) => createResponse(config, body)
    const client = new RequestClient({ adapter, responseReturn: 'data' })
    client.addResponseInterceptor(defaultResponseInterceptor())

    await expect(client.get('/failed')).rejects.toEqual(body)
  })

  it.each([
    ['brackets', '/items?ids%5B%5D=1&ids%5B%5D=2'],
    ['comma', '/items?ids=1%2C2'],
    ['indices', '/items?ids%5B0%5D=1&ids%5B1%5D=2'],
    ['repeat', '/items?ids=1&ids=2'],
  ] as const)('serializes array parameters using %s mode', async (paramsSerializer, expectedUrl) => {
    const adapter: AxiosAdapter = async (config) => createResponse(config, axios.getUri(config))
    const client = new RequestClient({ adapter, paramsSerializer })

    const response = await client.get<AxiosResponse<string>>('/items', { params: { ids: [1, 2] } })

    expect(response.data).toBe(expectedUrl)
  })

  it('supports a per-request serializer override', async () => {
    const adapter: AxiosAdapter = async (config) => createResponse(config, axios.getUri(config))
    const client = new RequestClient({ adapter, paramsSerializer: 'indices' })

    const response = await client.get<AxiosResponse<string>>('/items', {
      params: { ids: [1, 2] },
      paramsSerializer: 'repeat',
    })

    expect(response.data).toBe('/items?ids=1&ids=2')
  })

  it('unwraps Axios error response data', async () => {
    const body = { code: 4000, message: 'bad request' }
    const adapter: AxiosAdapter = async (config) => {
      const response = createResponse(config, body, 400)
      throw new AxiosError('Request failed with status code 400', AxiosError.ERR_BAD_REQUEST, config, undefined, response)
    }
    const client = new RequestClient({ adapter })

    await expect(client.get('/error')).rejects.toEqual(body)
  })
})
