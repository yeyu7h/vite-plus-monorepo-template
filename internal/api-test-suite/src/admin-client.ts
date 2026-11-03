import type { Enforcer } from 'casbin'

export type TestApp = {
  request: (path: string, init?: RequestInit) => Response | Promise<Response>
}

export type AdminRouteTestContext = {
  app: TestApp
  getAdminToken: () => Promise<string>
  getUserToken: () => Promise<string>
  enforcerPromise: Promise<Pick<Enforcer, 'addPolicy' | 'removePolicy'>>
  cleanup: (prefix: string) => Promise<void>
}

type RequestArguments = {
  param?: Record<string, string>
  query?: Record<string, string | number | boolean | undefined>
  json?: unknown
}

export function createAdminClient(app: TestApp, basePath: string, getToken: () => string) {
  return async (method: string, path = '', { param, query, json }: RequestArguments = {}, token: string | null = getToken()) => {
    const pathname = `${basePath}${path}`.replace(/:([a-z]+)/g, (_, key: string) => {
      if (param?.[key] === undefined) throw new Error(`Missing route parameter: ${key}`)
      return encodeURIComponent(param[key])
    })
    const search = new URLSearchParams()
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined) search.set(key, String(value))
    }
    const headers = new Headers()
    if (token) headers.set('Authorization', `Bearer ${token}`)
    if (json !== undefined) headers.set('Content-Type', 'application/json')
    return app.request(`${pathname}${search.size ? `?${search.toString()}` : ''}`, { method, headers, body: json === undefined ? undefined : JSON.stringify(json) })
  }
}

export async function readResponse<T>(response: Response) {
  return (await response.json()) as { data: T; message: string; error?: { issues?: unknown } }
}
