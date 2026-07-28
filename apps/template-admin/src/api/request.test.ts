import { beforeEach, expect, test, vi } from 'vite-plus/test'

vi.mock('@/constants/storage', () => ({
  ADMIN_ACCESS_TOKEN_STORAGE_KEY: 'template-admin:access-token',
}))

import { initializeAdminAuthentication, requestClient } from './request'

const storage = new Map<string, string>()

beforeEach(() => {
  storage.clear()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      removeItem: (key: string) => storage.delete(key),
      setItem: (key: string, value: string) => storage.set(key, value),
    },
  })
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { language: 'zh-CN' },
  })
})

test('shares one refresh operation and retries concurrent 401 requests', async () => {
  storage.set('template-admin:access-token', 'expired-token')

  let resolveRefresh: ((token: string) => void) | undefined
  let refreshCount = 0
  initializeAdminAuthentication({
    onSessionExpired: () => {},
    refreshAccessToken: () => {
      refreshCount += 1
      return new Promise((resolve) => {
        resolveRefresh = (token) => {
          storage.set('template-admin:access-token', token)
          resolve(token)
        }
      })
    },
  })

  const axios = requestClient.getAxiosInstance()
  const originalAdapter = axios.defaults.adapter
  let protectedRequests = 0
  axios.defaults.adapter = async (config) => {
    if (config.url === '/protected' && !(config as { __isRetryRequest?: boolean }).__isRetryRequest) {
      protectedRequests += 1
      throw Object.assign(new Error('Unauthorized'), {
        config,
        isAxiosError: true,
        response: { data: { message: '登录状态已失效' }, status: 401 },
      })
    }

    return {
      config,
      data: { data: { ok: true } },
      headers: {},
      status: 200,
      statusText: 'OK',
    }
  }

  try {
    const firstRequest = requestClient.get<{ ok: boolean }>('/protected')
    const secondRequest = requestClient.get<{ ok: boolean }>('/protected')

    await vi.waitFor(() => expect(refreshCount).toBe(1))
    resolveRefresh?.('fresh-token')

    await expect(Promise.all([firstRequest, secondRequest])).resolves.toEqual([{ ok: true }, { ok: true }])
    expect(protectedRequests).toBe(2)
  } finally {
    axios.defaults.adapter = originalAdapter
  }
})

test('cleans up once when refresh fails and never retries the failed request', async () => {
  let expiredCount = 0
  initializeAdminAuthentication({
    onSessionExpired: () => {
      expiredCount += 1
    },
    refreshAccessToken: async () => {
      throw new Error('刷新令牌不存在')
    },
  })

  const axios = requestClient.getAxiosInstance()
  const originalAdapter = axios.defaults.adapter
  axios.defaults.adapter = async (config) => {
    throw Object.assign(new Error('Unauthorized'), {
      config,
      isAxiosError: true,
      response: { data: { message: '登录状态已失效' }, status: 401 },
    })
  }

  try {
    await expect(requestClient.get('/protected')).rejects.toThrow('刷新令牌不存在')
    expect(expiredCount).toBe(1)
  } finally {
    axios.defaults.adapter = originalAdapter
  }
})
