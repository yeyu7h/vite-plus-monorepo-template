import { ADMIN_ACCESS_TOKEN_STORAGE_KEY } from '@/constants/storage'
import { baseRequestClient, requestClient } from './request'

export interface AdminLoginParams {
  captchaToken: string
  password: string
  username: string
}

export interface AdminLoginResult {
  accessToken: string
}

/** The existing admin UI model, mapped from template-api's userinfo response. */
export interface AdminUserInfo {
  avatar?: string
  home_path: string
  real_name: string
  roles: string[]
  user_id: string
  username: string
}

interface TemplateApiResponse<T> {
  data: T
}

interface TemplateApiUserInfo {
  avatar: null | string
  id: string
  nickName: string
  roles: string[]
  username: string
}

function toError(error: unknown) {
  if (error instanceof Error) return error

  const responseData = (error as { response?: { data?: { message?: unknown } } })?.response?.data
  const payload = responseData ?? error
  const message = typeof payload === 'object' && payload !== null && 'message' in payload && typeof payload.message === 'string' ? payload.message : '请求失败'
  return new Error(message)
}

async function authRequest<T>(url: string, method: 'get' | 'post', data?: unknown): Promise<T> {
  try {
    const token = localStorage.getItem(ADMIN_ACCESS_TOKEN_STORAGE_KEY)
    const response = await baseRequestClient.getAxiosInstance().request<TemplateApiResponse<T>>({
      data,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      method,
      url,
    })
    return response.data.data
  } catch (error) {
    throw toError(error)
  }
}

export async function loginApi(params: AdminLoginParams): Promise<AdminLoginResult> {
  return authRequest<AdminLoginResult>('/admin/auth/login', 'post', params)
}

export async function refreshTokenApi(): Promise<AdminLoginResult> {
  return authRequest<AdminLoginResult>('/admin/auth/refresh', 'post')
}

export async function logoutApi(): Promise<void> {
  await authRequest<Record<string, never>>('/admin/auth/logout', 'post')
}

export async function getUserInfoApi(): Promise<AdminUserInfo> {
  try {
    const user = await requestClient.get<TemplateApiUserInfo>('/admin/auth/userinfo')
    return {
      avatar: user.avatar ?? undefined,
      home_path: '/dashboard/workbench',
      real_name: user.nickName,
      roles: user.roles,
      user_id: user.id,
      username: user.username,
    }
  } catch (error) {
    throw toError(error)
  }
}
