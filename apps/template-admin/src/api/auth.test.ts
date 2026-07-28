import type { AdminLoginParams } from './auth'

import { beforeEach, expect, test, vi } from 'vite-plus/test'

const mocks = vi.hoisted(() => ({
  authRequest: vi.fn<(config: unknown) => Promise<unknown>>(),
  requestGet: vi.fn<(url: string) => Promise<unknown>>(),
}))

vi.mock('./request', () => ({
  baseRequestClient: {
    getAxiosInstance: () => ({ request: mocks.authRequest }),
  },
  requestClient: {
    get: mocks.requestGet,
  },
}))

vi.mock('@/constants/storage', () => ({
  ADMIN_ACCESS_TOKEN_STORAGE_KEY: 'template-admin:access-token',
}))

const storage = new Map<string, string>()

beforeEach(() => {
  vi.clearAllMocks()
  storage.clear()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      removeItem: (key: string) => storage.delete(key),
      setItem: (key: string, value: string) => storage.set(key, value),
    },
  })
})

test('sends template-api login payload and unwraps its access token', async () => {
  mocks.authRequest.mockResolvedValue({ data: { data: { accessToken: 'access-token' } } })
  const { loginApi } = await import('./auth')
  const params: AdminLoginParams = { captchaToken: 'captcha-token', password: '123456', username: 'admin' }

  await expect(loginApi(params)).resolves.toEqual({ accessToken: 'access-token' })
  expect(mocks.authRequest).toHaveBeenCalledWith(
    expect.objectContaining({
      data: params,
      method: 'post',
      url: '/admin/auth/login',
    }),
  )
})

test('maps template-api user fields to the existing admin user model', async () => {
  mocks.requestGet.mockResolvedValue({
    avatar: 'https://example.com/avatar.png',
    id: 'user-id',
    nickName: '管理员',
    roles: ['admin'],
    username: 'admin',
  })
  const { getUserInfoApi } = await import('./auth')

  await expect(getUserInfoApi()).resolves.toEqual({
    avatar: 'https://example.com/avatar.png',
    home_path: '/dashboard/workbench',
    real_name: '管理员',
    roles: ['admin'],
    user_id: 'user-id',
    username: 'admin',
  })
  expect(mocks.requestGet).toHaveBeenCalledWith('/admin/auth/userinfo')
})

test('exposes template-api error messages as Errors', async () => {
  mocks.authRequest.mockRejectedValue({ response: { data: { message: '用户名或密码错误' } } })
  const { loginApi } = await import('./auth')

  await expect(loginApi({ captchaToken: 'captcha-token', password: 'wrong', username: 'admin' })).rejects.toThrow('用户名或密码错误')
})
