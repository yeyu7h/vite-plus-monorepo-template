import type { RequestClientOptions } from '@monorepo/request'
import { isRecord } from '@monorepo/utils'
import { RequestClient, defaultResponseInterceptor, authenticateResponseInterceptor, errorMessageResponseInterceptor } from '@monorepo/request'
import { adminAppConfig } from '@/config/app'
import { ADMIN_ACCESS_TOKEN_STORAGE_KEY } from '@/constants/storage'

let requestErrorNotifier: ((message: string) => void) | undefined

export function setRequestErrorNotifier(notifier?: (message: string) => void) {
  requestErrorNotifier = notifier
}

function getRequestErrorMessage(message: string, error: unknown): string {
  const response = isRecord(error) ? error.response : void 0
  const responseData = isRecord(response) ? response.data : void 0

  if (isRecord(responseData)) {
    if (typeof responseData.error === 'string' && responseData.error.trim()) return responseData.error
    if (typeof responseData.message === 'string' && responseData.message.trim()) return responseData.message
  }

  const fallbackMessages: Record<string, string> = {
    'Bad request.': '请求参数有误',
    'Access forbidden.': '没有权限执行此操作',
    'Internal server error.': '服务器暂时不可用，请稍后重试',
    'Network error. Check your connection and try again.': '网络连接失败，请检查网络后重试',
    'The requested resource was not found.': '请求的资源不存在',
    'The request timed out.': '请求超时，请稍后重试',
    'Authentication is required.': '登录状态已失效，请重新登录',
  }

  return fallbackMessages[message] ?? message
}

function formatToken(token: string | null): string | null {
  return token ? `Bearer ${token}` : null
}

async function doReAuthenticate(): Promise<void> {
  const { useAdminAuthStore } = await import('@/stores/auth')
  await useAdminAuthStore().handleSessionExpired()
}

async function doRefreshToken(): Promise<string> {
  const result = await client.post<{ accessToken: string }>('/admin/auth/refresh', void 0, { __skipAuthRefresh: true })
  if (!result.accessToken) throw new Error('刷新令牌响应缺少访问令牌')

  localStorage.setItem(ADMIN_ACCESS_TOKEN_STORAGE_KEY, result.accessToken)

  const { useAdminAccessStore } = await import('@/stores/access')
  useAdminAccessStore().updateAccessToken(result.accessToken)

  return result.accessToken
}

function createRequestClient(baseURL: string, options?: RequestClientOptions) {
  const client = new RequestClient({ ...options, baseURL, withCredentials: true })

  client.addRequestInterceptor({
    fulfilled: (config) => {
      config.headers.Authorization = formatToken(localStorage.getItem(ADMIN_ACCESS_TOKEN_STORAGE_KEY))

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
      requestErrorNotifier?.(getRequestErrorMessage(message, error))
    }),
  )

  return client
}

export const client = createRequestClient(adminAppConfig.apiURL, { responseReturn: 'data' })
