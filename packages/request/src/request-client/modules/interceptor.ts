import type { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios'

import type { RequestInterceptorConfig, ResponseInterceptorConfig } from '../types'

const defaultRequestInterceptorConfig: RequestInterceptorConfig = {
  fulfilled: (config) => config,
  rejected: (error) => Promise.reject(error),
}

const defaultResponseInterceptorConfig: ResponseInterceptorConfig = {
  fulfilled: (response) => response,
  rejected: (error) => Promise.reject(error),
}

export class InterceptorManager {
  private readonly axiosInstance: AxiosInstance

  constructor(instance: AxiosInstance) {
    this.axiosInstance = instance
  }

  addRequestInterceptor({ fulfilled, rejected }: RequestInterceptorConfig = defaultRequestInterceptorConfig): void {
    this.axiosInstance.interceptors.request.use(fulfilled as (config: InternalAxiosRequestConfig) => InternalAxiosRequestConfig | Promise<InternalAxiosRequestConfig>, rejected)
  }

  addResponseInterceptor<T = unknown>({ fulfilled, rejected }: ResponseInterceptorConfig<T> = defaultResponseInterceptorConfig): void {
    this.axiosInstance.interceptors.response.use(fulfilled as (response: AxiosResponse) => AxiosResponse | Promise<AxiosResponse>, rejected)
  }
}
