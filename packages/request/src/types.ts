import type { AxiosRequestConfig, AxiosResponse, CreateAxiosDefaults, InternalAxiosRequestConfig } from 'axios'

export type ResponseReturn = 'body' | 'data' | 'raw'

export type ParamsSerializer = 'brackets' | 'comma' | 'indices' | 'repeat'

export interface ExtendOptions<T = unknown> {
  /** Array parameter encoding, or Axios's custom serializer. */
  paramsSerializer?: AxiosRequestConfig<T>['paramsSerializer'] | ParamsSerializer
  /** Select the raw Axios response, its body, or `body.data`. */
  responseReturn?: ResponseReturn
  /** Prevents the authentication interceptor from retrying a request twice. */
  __isRetryRequest?: boolean
}

export type RequestClientConfig<T = unknown> = Omit<AxiosRequestConfig<T>, 'paramsSerializer'> & ExtendOptions<T>

export type RequestClientOptions = Omit<CreateAxiosDefaults, 'paramsSerializer'> & ExtendOptions

export type RequestResponse<T = unknown> = AxiosResponse<T> & {
  config: RequestClientConfig<T>
}

export interface HttpResponse<T = unknown> {
  code: number | string
  data: T
  message: string
}

export interface RequestInterceptorConfig {
  fulfilled?: (config: InternalAxiosRequestConfig & ExtendOptions) => (InternalAxiosRequestConfig & ExtendOptions) | Promise<InternalAxiosRequestConfig & ExtendOptions>
  rejected?: (error: unknown) => unknown
}

export interface ResponseInterceptorConfig<T = unknown> {
  fulfilled?: (response: RequestResponse<T>) => RequestResponse<T> | T | Promise<RequestResponse<T> | T>
  rejected?: (error: unknown) => unknown
}

export type MakeErrorMessageFn = (message: string, error: unknown) => void
