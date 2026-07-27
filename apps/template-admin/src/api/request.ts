import type { RequestClientOptions } from '@monorepo/request'

import { defaultResponseInterceptor, errorMessageResponseInterceptor, RequestClient } from '@monorepo/request'

import { ADMIN_ACCESS_TOKEN_STORAGE_KEY } from '@/constants/storage'

const apiURL = import.meta.env.VITE_API_URL ?? '/api'

function formatToken(token: null | string) {
  return token ? `Bearer ${token}` : null
}

function createRequestClient(baseURL: string, options?: RequestClientOptions) {
  const client = new RequestClient({
    ...options,
    baseURL,
  })

  client.addRequestInterceptor({
    fulfilled: (config) => {
      const token = localStorage.getItem(ADMIN_ACCESS_TOKEN_STORAGE_KEY)
      const authorization = formatToken(token)

      if (authorization) config.headers.Authorization = authorization
      config.headers['Accept-Language'] = navigator.language
      return config
    },
  })

  client.addResponseInterceptor(
    defaultResponseInterceptor({
      codeField: 'code',
      dataField: 'data',
      successCode: 0,
    }),
  )

  client.addResponseInterceptor(
    errorMessageResponseInterceptor((message, error) => {
      // Applications can replace this with their UI notification service.
      console.error(message, error)
    }),
  )

  return client
}

/** Requests that use the application's `{ code, data, message }` response contract. */
export const requestClient = createRequestClient(apiURL, {
  responseReturn: 'data',
})

/** A raw Axios client intended for login, token refresh, and third-party endpoints. */
export const baseRequestClient = new RequestClient({ baseURL: apiURL })
