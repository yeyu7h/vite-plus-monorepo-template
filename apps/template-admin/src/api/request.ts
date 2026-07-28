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
    withCredentials: true,
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
      // template-api uses `{ data }` for successful responses, while a few
      // existing endpoints still use the `{ code, data }` convention.
      successCode: (code) => code === undefined || code === 0,
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

export interface AdminAuthenticationOptions {
  onSessionExpired: () => Promise<void> | void
  refreshAccessToken: () => Promise<string>
}

let authenticationOptions: AdminAuthenticationOptions | undefined
let refreshAccessTokenPromise: Promise<string> | undefined
let sessionExpiryPromise: Promise<void> | undefined

/**
 * Wires the shared client to the application's HttpOnly-refresh-token session.
 * This is deliberately initialized by the access store to avoid coupling this
 * low-level module to Pinia or the router.
 */
export function initializeAdminAuthentication(options: AdminAuthenticationOptions) {
  authenticationOptions = options
}

export function markAdminSessionActive() {
  sessionExpiryPromise = undefined
}

/** Requests that use the application's `{ code, data, message }` response contract. */
export const requestClient = createRequestClient(apiURL, {
  responseReturn: 'data',
})

/** A raw Axios client intended for login, token refresh, and third-party endpoints. */
export const baseRequestClient = new RequestClient({ baseURL: apiURL, withCredentials: true })

requestClient.addResponseInterceptor({
  rejected: async (error) => {
    const status = (error as { response?: { status?: number } }).response?.status
    const config = (error as { config?: { __isRetryRequest?: boolean; headers?: Record<string, string>; url?: string } }).config

    // The refresh endpoint is intentionally sent through baseRequestClient,
    // so this interceptor never retries it recursively.
    if (status !== 401 || !config || config.__isRetryRequest) throw error

    const auth = authenticationOptions
    if (!auth) throw error

    config.__isRetryRequest = true

    try {
      const nextRefreshPromise = refreshAccessTokenPromise ?? auth.refreshAccessToken()
      refreshAccessTokenPromise = nextRefreshPromise
      const token = await nextRefreshPromise
      const authorization = formatToken(token)
      if (authorization && config.headers) config.headers.Authorization = authorization
      return requestClient.request(config.url ?? '', config)
    } catch (refreshError) {
      sessionExpiryPromise ??= Promise.resolve(auth.onSessionExpired())
      await sessionExpiryPromise
      throw refreshError
    } finally {
      refreshAccessTokenPromise = undefined
    }
  },
})
