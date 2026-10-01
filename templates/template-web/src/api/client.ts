import { RequestClient, defaultResponseInterceptor } from '@monorepo/request'

const api = new RequestClient({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  responseReturn: 'data',
})

api.addResponseInterceptor(defaultResponseInterceptor())

export interface Health {
  status: string
  timestamp: string
}

export function getHealth() {
  return api.get<Health>('/health')
}
