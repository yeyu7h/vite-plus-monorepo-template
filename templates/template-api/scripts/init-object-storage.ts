import { objectStorageEnvSchema, requireObjectStorageConfig, resolveObjectStorageConfig } from '../src/lib/services/object-storage/config.ts'
import { initializeRustfsBucket, parseStorageCorsOrigins } from '../src/lib/services/object-storage/initialization.ts'

try {
  const result = objectStorageEnvSchema.safeParse(process.env)
  if (!result.success) {
    for (const issue of result.error.issues) console.error(`[ObjectStorage] ${issue.path.join('.')}: ${issue.message}`)
    process.exitCode = 1
  } else {
    const config = requireObjectStorageConfig(resolveObjectStorageConfig(result.data))
    await initializeRustfsBucket(config, parseStorageCorsOrigins(process.env.STORAGE_CORS_ALLOWED_ORIGINS))
    console.info(`[ObjectStorage] RustFS 桶已就绪: ${config.bucket}`)
  }
} catch (error) {
  // SDK errors can include signed requests; report only their type and HTTP status / SDK 错误可能包含签名请求，只报告错误类型和 HTTP 状态
  const status = error instanceof Error && '$metadata' in error ? (error.$metadata as { httpStatusCode?: number }).httpStatusCode : undefined
  console.error(`[ObjectStorage] 初始化失败: ${error instanceof Error ? error.name : 'UnknownError'}${status ? ` (HTTP ${status})` : ''}`)
  process.exitCode = 1
}
