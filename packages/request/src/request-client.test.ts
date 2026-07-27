import type { AxiosResponse } from 'axios'

import MockAdapter from 'axios-mock-adapter'
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test'

import { RequestClient } from './request-client.ts'

describe('RequestClient', () => {
  let client: RequestClient
  let mock: MockAdapter

  beforeEach(() => {
    client = new RequestClient()
    mock = new MockAdapter(client.getAxiosInstance())
  })

  afterEach(() => {
    mock.restore()
  })

  it('sends GET, POST, PUT, and DELETE requests', async () => {
    mock.onGet('/resource').reply(200, { method: 'get' })
    mock.onPost('/resource', { name: 'created' }).reply(200, { method: 'post' })
    mock.onPut('/resource', { name: 'updated' }).reply(200, { method: 'put' })
    mock.onDelete('/resource').reply(200, { method: 'delete' })

    const getResponse = await client.get<AxiosResponse<{ method: string }>>('/resource')
    const postResponse = await client.post<AxiosResponse<{ method: string }>>('/resource', { name: 'created' })
    const putResponse = await client.put<AxiosResponse<{ method: string }>>('/resource', { name: 'updated' })
    const deleteResponse = await client.delete<AxiosResponse<{ method: string }>>('/resource')

    expect(getResponse.data.method).toBe('get')
    expect(postResponse.data.method).toBe('post')
    expect(putResponse.data.method).toBe('put')
    expect(deleteResponse.data.method).toBe('delete')
  })

  it('serializes array parameters with the configured format', async () => {
    mock.onGet('/resource').reply((config) => {
      const serializer = config.paramsSerializer
      const query = typeof serializer === 'function' ? serializer({ ids: [1, 2] }) : serializer?.serialize?.({ ids: [1, 2] })

      return [200, { query }]
    })

    const response = await client.get<AxiosResponse<{ query: string }>>('/resource', {
      paramsSerializer: 'brackets',
    })

    expect(response.data.query).toBe('ids%5B%5D=1&ids%5B%5D=2')
  })

  it('uploads a FormData payload and downloads a Blob response', async () => {
    mock.onPost('/upload').reply((config) => [config.data instanceof FormData && config.data.get('name') === 'report' ? 200 : 400, { ok: true }])
    const file = new Blob(['report'], { type: 'text/plain' })
    mock.onGet('/download').reply(200, file)

    const uploadResponse = await client.upload<AxiosResponse<{ ok: boolean }>>('/upload', { file, name: 'report' })
    const downloadResponse = await client.download<AxiosResponse<Blob>>('/download')

    expect(uploadResponse.data.ok).toBe(true)
    expect(downloadResponse.data).toBeInstanceOf(Blob)
  })

  it('preserves network and timeout errors, but returns the HTTP error body', async () => {
    mock.onGet('/network').networkError()
    mock.onGet('/timeout').timeout()
    mock.onGet('/invalid').reply(422, { code: 422, message: 'invalid input' })

    await expect(client.get('/network')).rejects.toMatchObject({ isAxiosError: true, message: 'Network Error' })
    await expect(client.get('/timeout')).rejects.toMatchObject({ code: 'ECONNABORTED', isAxiosError: true })
    await expect(client.get('/invalid')).rejects.toEqual({ code: 422, message: 'invalid input' })
  })
})
