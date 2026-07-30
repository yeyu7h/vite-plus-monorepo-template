import { client } from '@/api/request'
import type { paths } from '#/openapi/admin'

type _LoginOperation = paths['/api/admin/auth/login']['post']
type _LoginBody = NonNullable<_LoginOperation['requestBody']>['content']['application/json']
type _LoginResponse = _LoginOperation['responses'][200]['content']['application/json']

export namespace CoreAuthApi {
  export type LoginBody = _LoginBody
  export type LoginResult = _LoginResponse['data']
}

export const coreAuthApi = {
  login: (data: CoreAuthApi.LoginBody) => client.post<CoreAuthApi.LoginResult>('/admin/auth/login', data),
}
