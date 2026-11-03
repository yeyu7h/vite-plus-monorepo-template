import { createLazySingleton } from '@monorepo/server-core'
import env from '@/env'
import { resolveObjectStorageConfig } from './config'
import { createObjectStorage } from './storage'
import type { GenerateDownloadUrlParams, GenerateUploadUrlParams } from './storage'

export const objectStorageConfig = resolveObjectStorageConfig(env)
export const getObjectStorage = createLazySingleton('object-storage', () => createObjectStorage(objectStorageConfig), { destroy: (storage) => storage.destroy() })

export const generateUploadUrl = (params: GenerateUploadUrlParams) => getObjectStorage().generateUploadUrl(params)
export const generateDownloadUrl = (params: GenerateDownloadUrlParams) => getObjectStorage().generateDownloadUrl(params)
export type { GenerateDownloadUrlParams, GenerateUploadUrlParams, PresignedUrlResult, PutObjectParams } from './storage'
