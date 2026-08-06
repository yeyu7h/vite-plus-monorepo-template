import type { RequestClientOptions } from '@monorepo/request'

import { RequestClient, defaultResponseInterceptor, authenticateResponseInterceptor, errorMessageResponseInterceptor } from '@monorepo/request'
import { ADMIN_ACCESS_TOKEN_STORAGE_KEY } from '@/constants/storage'

function formatToken(token: string | null): string | null {
  return token ? `Bearer ${token}` : null
}

async function doReAuthenticate(): Promise<void> {
  const { useAdminAuthStore } = await import('@/stores/auth')
  await useAdminAuthStore().handleSessionExpired()
}

async function doRefreshToken(): Promise<string> {
  const result = await client.post<{ accessToken: string }>('/admin/auth/refresh', undefined, { __skipAuthRefresh: true })
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

  client.addResponseInterceptor(errorMessageResponseInterceptor())

  return client
}

export const client = createRequestClient('/api', { responseReturn: 'data' })
