import type * as routes from './resources.routes'
import type { AdminRouteHandler } from '@monorepo/server-core'

export type { GenerateUploadUrlParams, GenerateDownloadUrlParams, PresignedUrlResult } from '@/lib/services/object-storage'

type RouteTypes = {
  [K in keyof typeof routes]: (typeof routes)[K]
}

export type ObjectStorageRouteHandlerType<T extends keyof RouteTypes> = AdminRouteHandler<RouteTypes[T]>
