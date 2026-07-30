import type { RequestClient } from '../request-client'
import type { RequestClientConfig, RequestResponse } from '../types'

export type DownloadRequestConfig = {
  /**
   * raw returns the complete Axios response; body returns the Blob itself.
   */
  responseReturn?: 'body' | 'raw'
} & Omit<RequestClientConfig, 'responseReturn'>

export class FileDownloader {
  private readonly client: RequestClient

  constructor(client: RequestClient) {
    this.client = client
  }

  public async download<T = Blob>(url: string, config?: DownloadRequestConfig & { responseReturn?: 'body' }): Promise<T>
  public async download<T = Blob>(url: string, config?: DownloadRequestConfig & { responseReturn: 'raw' }): Promise<RequestResponse<T>>
  public async download<T = Blob>(url: string, config?: DownloadRequestConfig): Promise<RequestResponse<T> | T> {
    const finalConfig: DownloadRequestConfig = { responseReturn: 'body', ...config, responseType: 'blob' }

    return this.client.get<RequestResponse<T> | T>(url, finalConfig)
  }
}
