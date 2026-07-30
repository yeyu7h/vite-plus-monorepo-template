import type { RequestClient } from './request-client'
import type { ExtendOptions, MakeErrorMessageFn, ResponseInterceptorConfig } from './types'

import axios from 'axios'

type ResponseRecord = Record<PropertyKey, unknown>

export interface DefaultResponseInterceptorOptions {
  /**
   * Field containing the business result code.
   * When the response does not contain this field, business-code validation is skipped and the HTTP status determines whether the request succeeded.
   * @default 'code'
   */
  codeField?: string
  /** Field or resolver returning the payload. @default 'data' */
  dataField?: ((response: ResponseRecord) => unknown) | string
  /** Value or predicate that identifies a successful business response when the code field is present. @default 0 */
  successCode?: ((code: unknown) => boolean) | number | string
}

export interface AuthenticateResponseInterceptorOptions {
  /** Request client used to retry failed requests and coordinate concurrent token refreshes. */
  client: RequestClient
  /** Handles an expired session, such as clearing authentication state or redirecting to the login page. */
  doReAuthenticate: () => Promise<void>
  /** Refreshes the access token and returns the new unformatted token value. */
  doRefreshToken: () => Promise<string>
  /** Determines whether a 401 response should attempt a token refresh before re-authentication. */
  enableRefreshToken: boolean
  /** Converts a raw token into the Authorization header value; return null to omit the token. */
  formatToken: (token: string) => string | null
}

function isResponseRecord(value: unknown): value is ResponseRecord {
  return typeof value === 'object' && value !== null
}

export const defaultResponseInterceptor = ({ codeField = 'code', dataField = 'data', successCode = 0 }: DefaultResponseInterceptorOptions = {}): ResponseInterceptorConfig => ({
  fulfilled: (response) => {
    const { config, data: responseData, status } = response

    if (config.responseReturn === 'raw') {
      return response
    }

    if (status >= 200 && status < 400) {
      if (config.responseReturn === 'body') return responseData

      if (isResponseRecord(responseData)) {
        const code = responseData[codeField]
        const hasBusinessCode = Object.hasOwn(responseData, codeField)
        const isSuccess = !hasBusinessCode || (typeof successCode === 'function' ? successCode(code) : code === successCode)

        if (isSuccess) return typeof dataField === 'function' ? dataField(responseData) : responseData[dataField]
      }
    }

    throw Object.assign({}, response, { response })
  },
})

export const authenticateResponseInterceptor = ({ client, doReAuthenticate, doRefreshToken, enableRefreshToken, formatToken }: AuthenticateResponseInterceptorOptions): ResponseInterceptorConfig => ({
  rejected: async (error: unknown) => {
    if (!axios.isAxiosError(error)) throw error

    const { config, response } = error
    if (response?.status !== 401 || !config) throw error

    const retryConfig = config as typeof config & ExtendOptions

    if (!enableRefreshToken || retryConfig.__isRetryRequest) {
      await doReAuthenticate()
      throw error
    }

    if (client.isRefreshing) {
      return new Promise((resolve) => {
        client.refreshTokenQueue.push((newToken: string) => {
          config.headers.Authorization = formatToken(newToken)
          resolve(client.request(config.url ?? '', { ...config }))
        })
      })
    }

    client.isRefreshing = true
    retryConfig.__isRetryRequest = true

    try {
      const newToken = await doRefreshToken()
      client.refreshTokenQueue.forEach((callback) => callback(newToken))
      client.refreshTokenQueue = []

      config.headers.Authorization = formatToken(newToken)
      return client.request(config.url ?? '', { ...config })
    } catch (refreshError: unknown) {
      client.refreshTokenQueue.forEach((callback) => callback(''))
      client.refreshTokenQueue = []
      console.error('Refresh token failed, please login again.')
      await doReAuthenticate()
      throw refreshError
    } finally {
      client.isRefreshing = false
    }
  },
})

const defaultErrorMessages = {
  badRequest: 'Bad request.',
  forbidden: 'Access forbidden.',
  internalServerError: 'Internal server error.',
  networkError: 'Network error. Check your connection and try again.',
  notFound: 'The requested resource was not found.',
  requestTimeout: 'The request timed out.',
  unauthorized: 'Authentication is required.',
} as const

function getStatusErrorMessage(status: number | undefined): string {
  switch (status) {
    case 400:
      return defaultErrorMessages.badRequest
    case 401:
      return defaultErrorMessages.unauthorized
    case 403:
      return defaultErrorMessages.forbidden
    case 404:
      return defaultErrorMessages.notFound
    case 408:
      return defaultErrorMessages.requestTimeout
    default:
      return defaultErrorMessages.internalServerError
  }
}

export const errorMessageResponseInterceptor = (makeErrorMessage?: MakeErrorMessageFn): ResponseInterceptorConfig => ({
  rejected: (error: unknown) => {
    if (axios.isCancel(error)) return Promise.reject(error)

    const errorText = String(error)
    if (errorText.includes('Network Error')) {
      makeErrorMessage?.(defaultErrorMessages.networkError, error)
      return Promise.reject(error)
    }

    if (axios.isAxiosError(error) && error.message.includes('timeout')) {
      makeErrorMessage?.(defaultErrorMessages.requestTimeout, error)
      return Promise.reject(error)
    }

    const status = axios.isAxiosError(error) ? error.response?.status : undefined
    makeErrorMessage?.(getStatusErrorMessage(status), error)
    return Promise.reject(error)
  },
})
