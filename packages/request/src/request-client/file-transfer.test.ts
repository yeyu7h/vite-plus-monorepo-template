import type { AxiosAdapter } from 'axios'

import { AxiosHeaders } from 'axios'
import { describe, expect, it } from 'vite-plus/test'

import { defaultResponseInterceptor } from './preset-interceptors'
import { RequestClient } from './request-client'

describe('file transfer helpers', () => {
  it('builds indexed FormData while omitting undefined values', async () => {
    const adapter: AxiosAdapter = async (config) => {
      const formData = config.data as FormData
      return {
        config,
        data: {
          contentType: config.headers.getContentType(),
          entries: [...formData.entries()].map(([key, value]) => [key, typeof value === 'string' ? value : value.type]),
        },
        headers: new AxiosHeaders(),
        status: 200,
        statusText: 'OK',
      }
    }
    const client = new RequestClient({ adapter, responseReturn: 'body' })
    client.addResponseInterceptor(defaultResponseInterceptor())
    const file = new Blob(['contents'], { type: 'text/plain' })

    const result = await client.upload<{ contentType: string; entries: string[][] }>('/upload', {
      file,
      labels: ['one', undefined, 'three'],
      note: undefined,
      title: 'document',
    })

    expect(result.contentType).toBe('multipart/form-data')
    expect(result.entries).toEqual([
      ['file', 'text/plain'],
      ['labels[0]', 'one'],
      ['labels[2]', 'three'],
      ['title', 'document'],
    ])
  })

  it('forces Blob responses and returns the response body by default', async () => {
    const blob = new Blob(['download'], { type: 'text/plain' })
    const adapter: AxiosAdapter = async (config) => ({
      config,
      data: config.responseType === 'blob' ? blob : null,
      headers: new AxiosHeaders(),
      status: 200,
      statusText: 'OK',
    })
    const client = new RequestClient({ adapter })
    client.addResponseInterceptor(defaultResponseInterceptor())

    await expect(client.download('/download')).resolves.toBe(blob)
  })
})
