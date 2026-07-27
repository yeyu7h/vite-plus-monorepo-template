import type { AxiosError } from 'axios'
import type { MakeErrorMessageFn, ResponseInterceptorConfig } from './types.ts'

import { isCancel } from 'axios'

import type { RequestClient } from './request-client.ts'

export function defaultResponseInterceptor({
  codeField = 'code',
  dataField = 'data',
  successCode = 0,
}: {
  codeField?: string
  dataField?: string | ((response: Record<string, unknown>) => unknown)
  successCode?: number | string | ((code: unknown) => boolean)
} = {}): ResponseInterceptorConfig {
  return {
    fulfilled: (response) => {
      const { config, data, status } = response
      if (config.responseReturn === 'raw') return response
      if (status < 200 || status >= 400) throw Object.assign({}, response, { response })
      if (config.responseReturn === 'body') return data

      const body = data as Record<string, unknown>
      const code = body?.[codeField]
      const succeeded = typeof successCode === 'function' ? successCode(code) : code === successCode
      if (!succeeded) throw Object.assign({}, response, { response })
      return typeof dataField === 'function' ? dataField(body) : body[dataField]
    },
  }
}

export function authenticateResponseInterceptor({
  client,
  doReAuthenticate,
  doRefreshToken,
  enableRefreshToken,
  formatToken,
}: {
  client: RequestClient
  doReAuthenticate: () => Promise<void>
  doRefreshToken: () => Promise<string>
  enableRefreshToken: boolean
  formatToken: (token: string | null) => string | null
}): ResponseInterceptorConfig {
  return {
    rejected: async (error) => {
      const axiosError = error as AxiosError & { config?: AxiosError['config'] & { __isRetryRequest?: boolean } }
      const config = axiosError.config
      if (axiosError.response?.status !== 401 || !config) throw error
      if (!enableRefreshToken || config.__isRetryRequest) {
        await doReAuthenticate()
        throw error
      }
      if (client.isRefreshing) {
        return new Promise((resolve, reject) => {
          client.refreshTokenQueue.push({ config, reject, resolve })
        })
      }

      client.isRefreshing = true
      config.__isRetryRequest = true
      try {
        const token = await doRefreshToken()
        if (config.headers) config.headers.Authorization = formatToken(token)
        client.refreshTokenQueue.splice(0).forEach(({ config: queuedConfig, resolve }) => {
          if (queuedConfig.headers) queuedConfig.headers.Authorization = formatToken(token)
          queuedConfig.__isRetryRequest = true
          resolve(client.request(queuedConfig.url ?? '', queuedConfig))
        })
        return client.request(config.url ?? '', config)
      } catch (refreshError) {
        client.refreshTokenQueue.splice(0).forEach(({ reject }) => reject(refreshError))
        await doReAuthenticate()
        throw refreshError
      } finally {
        client.isRefreshing = false
      }
    },
  }
}

export function errorMessageResponseInterceptor(makeErrorMessage?: MakeErrorMessageFn): ResponseInterceptorConfig {
  return {
    rejected: (error) => {
      if (isCancel(error)) return Promise.reject(error)
      const axiosError = error as AxiosError
      const message = axiosError.message.includes('Network Error')
        ? '网络连接失败，请检查网络设置。'
        : axiosError.message.includes('timeout')
          ? '请求超时，请稍后重试。'
          : ({ 400: '请求参数错误。', 401: '登录状态已失效。', 403: '没有访问权限。', 404: '请求资源不存在。', 408: '请求超时，请稍后重试。' }[axiosError.response?.status ?? 500] ??
            '服务器内部错误。')
      makeErrorMessage?.(message, error)
      return Promise.reject(error)
    },
  }
}
