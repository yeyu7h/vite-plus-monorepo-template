import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'

import type { RequestClientConfig, RequestClientOptions } from './types'

import axios from 'axios'
import { defu } from 'defu'
import qs from 'qs'

import { FileDownloader } from './modules/downloader'
import { InterceptorManager } from './modules/interceptor'
import { FileUploader } from './modules/uploader'

function getParamsSerializer(paramsSerializer: RequestClientOptions['paramsSerializer']): AxiosRequestConfig['paramsSerializer'] {
  if (typeof paramsSerializer !== 'string') return paramsSerializer

  return (params: Record<string, unknown>) => qs.stringify(params, { arrayFormat: paramsSerializer })
}

function bindMethods(instance: object): void {
  const prototype = Object.getPrototypeOf(instance) as object

  for (const propertyName of Object.getOwnPropertyNames(prototype)) {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, propertyName)
    const propertyValue = Reflect.get(instance, propertyName) as unknown

    if (typeof propertyValue === 'function' && propertyName !== 'constructor' && descriptor && !descriptor.get && !descriptor.set) {
      Reflect.set(instance, propertyName, propertyValue.bind(instance))
    }
  }
}

function getResponseData(error: unknown): { found: boolean; value?: unknown } {
  if (typeof error !== 'object' || error === null || !('response' in error)) return { found: false }

  const response = error.response
  if (typeof response !== 'object' || response === null || !('data' in response)) return { found: false }

  return { found: true, value: response.data }
}

export class RequestClient {
  public addRequestInterceptor: InterceptorManager['addRequestInterceptor']
  public addResponseInterceptor: InterceptorManager['addResponseInterceptor']
  public download: FileDownloader['download']
  public upload: FileUploader['upload']

  public isRefreshing = false
  public refreshTokenQueue: Array<(token: string, error?: unknown) => void> = []

  private readonly instance: AxiosInstance

  constructor(options: RequestClientOptions = {}) {
    const defaultConfig: RequestClientOptions = {
      headers: { 'Content-Type': 'application/json;charset=utf-8' },
      responseReturn: 'raw',
      timeout: 10_000,
    }
    const requestConfig = defu(options, defaultConfig)
    const { paramsSerializer, ...axiosConfig } = requestConfig

    this.instance = axios.create({ ...axiosConfig, paramsSerializer: getParamsSerializer(paramsSerializer) })

    bindMethods(this)

    const interceptorManager = new InterceptorManager(this.instance)
    this.addRequestInterceptor = interceptorManager.addRequestInterceptor.bind(interceptorManager)
    this.addResponseInterceptor = interceptorManager.addResponseInterceptor.bind(interceptorManager)

    const fileUploader = new FileUploader(this)
    this.upload = fileUploader.upload.bind(fileUploader)

    const fileDownloader = new FileDownloader(this)
    this.download = fileDownloader.download.bind(fileDownloader)
  }

  public delete<T = unknown>(url: string, config?: RequestClientConfig): Promise<T> {
    return this.request<T>(url, { ...config, method: 'DELETE' })
  }

  public get<T = unknown>(url: string, config?: RequestClientConfig): Promise<T> {
    return this.request<T>(url, { ...config, method: 'GET' })
  }

  public post<T = unknown>(url: string, data?: unknown, config?: RequestClientConfig): Promise<T> {
    return this.request<T>(url, { ...config, data, method: 'POST' })
  }

  public put<T = unknown>(url: string, data?: unknown, config?: RequestClientConfig): Promise<T> {
    return this.request<T>(url, { ...config, data, method: 'PUT' })
  }

  public async request<T>(url: string, config: RequestClientConfig = {}): Promise<T> {
    try {
      const { paramsSerializer, ...axiosConfig } = config
      const response: AxiosResponse<T> = await this.instance({
        url,
        ...axiosConfig,
        ...(paramsSerializer ? { paramsSerializer: getParamsSerializer(paramsSerializer) } : {}),
      })

      return response as T
    } catch (error: unknown) {
      const responseData = getResponseData(error)
      if (responseData.found) throw responseData.value
      throw error
    }
  }
}
