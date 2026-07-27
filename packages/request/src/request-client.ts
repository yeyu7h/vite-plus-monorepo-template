import type { AxiosInstance, AxiosRequestConfig, AxiosResponse, RawAxiosHeaders } from 'axios'
import type { ParamsSerializer, RequestClientConfig, RequestClientOptions, RequestInterceptorConfig, ResponseInterceptorConfig } from './types.ts'

import axios, { AxiosHeaders } from 'axios'
import qs from 'qs'

function toParamsSerializer(paramsSerializer: RequestClientOptions['paramsSerializer']) {
  if (typeof paramsSerializer !== 'string') return paramsSerializer

  const formats: Record<ParamsSerializer, qs.IStringifyOptions['arrayFormat']> = {
    brackets: 'brackets',
    comma: 'comma',
    indices: 'indices',
    repeat: 'repeat',
  }

  return (params: unknown) => qs.stringify(params, { arrayFormat: formats[paramsSerializer] })
}

type UploadValue = Blob | File | boolean | null | number | string | undefined

export interface RefreshTokenQueueItem {
  config: RequestClientConfig
  reject: (reason?: unknown) => void
  resolve: (value: unknown) => void
}

function withContentType(contentType: string, headers?: unknown) {
  return {
    'Content-Type': contentType,
    ...AxiosHeaders.from(headers as AxiosHeaders | RawAxiosHeaders | undefined).toJSON(),
  }
}

export class RequestClient {
  public isRefreshing = false
  public refreshTokenQueue: RefreshTokenQueueItem[] = []
  private readonly instance: AxiosInstance

  constructor(options: RequestClientOptions = {}) {
    this.instance = axios.create({
      headers: withContentType('application/json;charset=utf-8', options.headers),
      responseReturn: 'raw',
      timeout: 10_000,
      ...options,
      paramsSerializer: toParamsSerializer(options.paramsSerializer),
    })
  }

  public addRequestInterceptor({ fulfilled, rejected }: RequestInterceptorConfig = {}) {
    return this.instance.interceptors.request.use(fulfilled, rejected)
  }

  public addResponseInterceptor<T = unknown>({ fulfilled, rejected }: ResponseInterceptorConfig<T> = {}) {
    return this.instance.interceptors.response.use(fulfilled as unknown as ((response: AxiosResponse) => AxiosResponse | Promise<AxiosResponse>) | undefined, rejected)
  }

  public delete<T = unknown>(url: string, config?: RequestClientConfig): Promise<T> {
    return this.request<T>(url, { ...config, method: 'DELETE' })
  }

  public download<T = Blob>(url: string, config?: Omit<RequestClientConfig, 'responseReturn'> & { responseReturn?: 'body' | 'raw' }): Promise<T> {
    return this.get<T>(url, { responseReturn: 'body', responseType: 'blob', ...config })
  }

  public get<T = unknown>(url: string, config?: RequestClientConfig): Promise<T> {
    return this.request<T>(url, { ...config, method: 'GET' })
  }

  public getAxiosInstance() {
    return this.instance
  }

  public post<T = unknown>(url: string, data?: unknown, config?: RequestClientConfig): Promise<T> {
    return this.request<T>(url, { ...config, data, method: 'POST' })
  }

  public put<T = unknown>(url: string, data?: unknown, config?: RequestClientConfig): Promise<T> {
    return this.request<T>(url, { ...config, data, method: 'PUT' })
  }

  public async request<T = unknown>(url: string, config: RequestClientConfig = {}): Promise<T> {
    try {
      const { paramsSerializer, ...axiosConfig } = config
      return (await this.instance({
        url,
        ...axiosConfig,
        ...(paramsSerializer ? { paramsSerializer: toParamsSerializer(paramsSerializer) } : {}),
      } as AxiosRequestConfig)) as T
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) throw error.response.data
      throw error
    }
  }

  public upload<T = unknown>(url: string, data: Record<string, UploadValue | UploadValue[]>, config?: RequestClientConfig): Promise<T> {
    const formData = new FormData()

    for (const [key, value] of Object.entries(data)) {
      const values = Array.isArray(value) ? value : [value]
      values.forEach((item, index) => {
        if (item === null || item === undefined) return
        const field = Array.isArray(value) ? `${key}[${index}]` : key
        if (item instanceof Blob) formData.append(field, item)
        else formData.append(field, String(item))
      })
    }

    return this.post<T>(url, formData, {
      ...config,
      headers: withContentType('multipart/form-data', config?.headers),
    })
  }
}
