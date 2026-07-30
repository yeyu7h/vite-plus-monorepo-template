import type { RequestClient } from '../request-client'
import type { RequestClientConfig } from '../types'
import type { RawAxiosHeaders } from 'axios'

import { AxiosHeaders } from 'axios'

function appendFormDataValue(formData: FormData, key: string, value: unknown): void {
  if (value === void 0) return
  if (value instanceof Blob) return formData.append(key, value)

  // oxlint-disable-next-line typescript/no-base-to-string -- This intentionally matches the browser's native FormData coercion.
  formData.append(key, String(value))
}

export class FileUploader {
  private readonly client: RequestClient

  constructor(client: RequestClient) {
    this.client = client
  }

  public async upload<T = unknown>(url: string, data: { file: Blob | File; [key: string]: unknown }, config?: RequestClientConfig): Promise<T> {
    const formData = new FormData()

    for (const [key, value] of Object.entries(data)) {
      if (Array.isArray(value)) {
        value.forEach((item, index) => appendFormDataValue(formData, `${key}[${index}]`, item))
      } else {
        appendFormDataValue(formData, key, value)
      }
    }

    const headers = AxiosHeaders.from(config?.headers as AxiosHeaders | RawAxiosHeaders | undefined)
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'multipart/form-data')

    const finalConfig: RequestClientConfig = { ...config, headers }

    return this.client.post<T>(url, formData, finalConfig)
  }
}
