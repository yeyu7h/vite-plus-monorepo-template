import type { RequestClientOptions } from '@monorepo/request'
import { isRecord } from '@monorepo/utils'
import { RequestClient, defaultResponseInterceptor, authenticateResponseInterceptor, errorMessageResponseInterceptor } from '@monorepo/request'
import { adminAppConfig } from '@/config/app'
import { ADMIN_ACCESS_TOKEN_STORAGE_KEY } from '@/constants/storage'

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
      const response = isRecord(error) ? error.response : void 0
      const responseData = isRecord(response) && isRecord(response.data) ? response.data : {}
      const errorMessage = responseData?.error ?? responseData?.message ?? ''
      console.log('[errorMessage]-55', errorMessage || message)
    }),
  )

  return client
}

export const client = createRequestClient(adminAppConfig.apiURL, { responseReturn: 'data' })
