import type { AxiosRequestConfig, AxiosResponse, CreateAxiosDefaults, InternalAxiosRequestConfig } from 'axios'

export type ParamsSerializerMode = 'brackets' | 'comma' | 'indices' | 'repeat'

export interface ExtendOptions<T = unknown> {
  /**
   * Array parameter serialization:
   * - brackets: ids[]=1&ids[]=2
   * - comma: ids=1,2
   * - indices: ids[0]=1&ids[1]=2
   * - repeat: ids=1&ids=2
   */
  paramsSerializer?: AxiosRequestConfig<T>['paramsSerializer'] | ParamsSerializerMode
  /** raw returns AxiosResponse, body returns `response.data`, and data unwraps the configured data field after checking the business success code when present. */
  responseReturn?: 'body' | 'data' | 'raw'
  /** Internal retry marker used by the authentication interceptor. */
  __isRetryRequest?: boolean
}

export type RequestClientConfig<T = unknown> = ExtendOptions<T> & Omit<AxiosRequestConfig<T>, 'paramsSerializer'>

export type RequestResponse<T = unknown, D = unknown> = Omit<AxiosResponse<T, D>, 'config'> & { config: ExtendOptions<D> & InternalAxiosRequestConfig<D> }

export type RequestClientOptions<T = unknown> = ExtendOptions<T> & Omit<CreateAxiosDefaults<T>, 'paramsSerializer'>

export type RequestContentType = 'application/json;charset=utf-8' | 'application/octet-stream;charset=utf-8' | 'application/x-www-form-urlencoded;charset=utf-8' | 'multipart/form-data;charset=utf-8'

export interface RequestInterceptorConfig {
  fulfilled?: (config: ExtendOptions & InternalAxiosRequestConfig) => (ExtendOptions & InternalAxiosRequestConfig) | Promise<ExtendOptions & InternalAxiosRequestConfig>
  rejected?: (error: unknown) => unknown
}

export interface ResponseInterceptorConfig<T = unknown> {
  fulfilled?: (response: RequestResponse<T>) => unknown
  rejected?: (error: unknown) => unknown
}

export type MakeErrorMessageFn = (message: string, error: unknown) => void

export interface HttpResponse<T = unknown> {
  /** Optional business result code. HTTP status determines success when omitted. */
  code?: number | string
  /** Business payload returned by the API. */
  data: T
  /** Optional human-readable message describing the result. */
  message?: string
}
