import { client } from '@/api/request'
import type { paths } from '#/openapi/admin'

export interface AdminUserInfo {
  avatar?: string
  homePath?: string
  real_name: string
  roles: string[]
  user_id: string
  username: string
}

type _LoginOperation = paths['/api/admin/auth/login']['post']
type _LoginBody = NonNullable<_LoginOperation['requestBody']>['content']['application/json']
type _LoginResponse = _LoginOperation['responses'][200]['content']['application/json']
type _RefreshOperation = paths['/api/admin/auth/refresh']['post']
type _RefreshResponse = _RefreshOperation['responses'][200]['content']['application/json']
type _LogoutOperation = paths['/api/admin/auth/logout']['post']
type _LogoutResponse = _LogoutOperation['responses'][200]['content']['application/json']
type _GetIdentityOperation = paths['/api/admin/auth/userinfo']['get']
type _GetIdentityResponse = _GetIdentityOperation['responses'][200]['content']['application/json']
type _GetAccessOperation = paths['/api/admin/auth/access']['get']
type _GetAccessResponse = _GetAccessOperation['responses'][200]['content']['application/json']

export namespace CoreAuthApi {
  export type AccessResult = _GetAccessResponse['data']
  export type IdentityResult = _GetIdentityResponse['data']
  export type LoginBody = _LoginBody
  export type LoginResult = _LoginResponse['data']
  export type LogoutResult = _LogoutResponse['data']
  export type RefreshResult = _RefreshResponse['data']
}

export const coreAuthApi = {
  getAccess: () => client.get<CoreAuthApi.AccessResult>('/admin/auth/access'),
  getIdentity: () => client.get<CoreAuthApi.IdentityResult>('/admin/auth/userinfo'),
  login: (data: CoreAuthApi.LoginBody) => client.post<CoreAuthApi.LoginResult>('/admin/auth/login', data),
  logout: () => client.post<CoreAuthApi.LogoutResult>('/admin/auth/logout'),
  refresh: () => client.post<CoreAuthApi.RefreshResult>('/admin/auth/refresh', undefined, { __skipAuthRefresh: true }),
}
