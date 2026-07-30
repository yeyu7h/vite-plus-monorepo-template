import type { RequestClientOptions } from '@monorepo/request'

import { RequestClient, defaultResponseInterceptor, authenticateResponseInterceptor, errorMessageResponseInterceptor } from '@monorepo/request'

function formatToken(token: string | null): string | null {
  return token ? `Bearer ${token}` : null
}

async function doReAuthenticate(): Promise<void> {
  return
}

async function doRefreshToken(): Promise<string> {
  return ''
}

function createRequestClient(baseURL: string, options?: RequestClientOptions) {
  const client = new RequestClient({ ...options, baseURL })

  client.addRequestInterceptor({
    fulfilled: (config) => {
      config.headers.Authorization = formatToken('')

      return config
    },
  })

  client.addResponseInterceptor(defaultResponseInterceptor())

  client.addResponseInterceptor(
    authenticateResponseInterceptor({
      client,
      enableRefreshToken: true,
      doReAuthenticate,
      doRefreshToken,
      formatToken,
    }),
  )

  client.addResponseInterceptor(
    errorMessageResponseInterceptor((message, error) => {
      console.log('[message, error]-42', message, error)
    }),
  )

  return client
}

export const client = createRequestClient('/api', { responseReturn: 'data' })
