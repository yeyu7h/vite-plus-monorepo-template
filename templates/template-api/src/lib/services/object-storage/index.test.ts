import { describe, expect, it, vi } from 'vite-plus/test'

vi.mock('@/env', () => ({ default: { STORAGE_PROVIDER: 'none' } }))
vi.mock('./storage', () => ({ createObjectStorage: vi.fn<typeof import('./storage').createObjectStorage>() }))

import { createObjectStorage } from './storage'
import { generateDownloadUrl, generateUploadUrl, getObjectStorage, objectStorageConfig } from './index'

describe('disabled object storage', () => {
  it('rejects direct use and signing without constructing an S3 client', () => {
    expect(objectStorageConfig).toBeNull()
    expect(() => getObjectStorage()).toThrow('对象存储未启用')
    expect(() => generateUploadUrl({ fileName: 'test.png' })).toThrow(expect.objectContaining({ status: 503 }))
    expect(() => generateDownloadUrl({ fileName: 'test.png' })).toThrow(expect.objectContaining({ status: 503 }))
    expect(createObjectStorage).not.toHaveBeenCalled()
  })
})
