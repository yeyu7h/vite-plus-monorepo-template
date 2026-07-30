import { client } from '@/api/request'
import type { paths } from '#/openapi/admin'

type _LoginOperation = paths['/api/admin/auth/login']['post']
type _LoginBody = NonNullable<_LoginOperation['requestBody']>['content']['application/json']
type _LoginResponse = _LoginOperation['responses'][200]['content']['application/json']
type _GetIdentityOperation = paths['/api/admin/auth/userinfo']['get']
type _GetIdentityResponse = _GetIdentityOperation['responses'][200]['content']['application/json']

export namespace CoreAuthApi {
  export type IdentityResult = _GetIdentityResponse['data']
  export type LoginBody = _LoginBody
  export type LoginResult = _LoginResponse['data']
}

export const coreAuthApi = {
  getIdentity: () => client.get<CoreAuthApi.IdentityResult>('/admin/auth/userinfo'),
  login: (data: CoreAuthApi.LoginBody) => client.post<CoreAuthApi.LoginResult>('/admin/auth/login', data),
}
