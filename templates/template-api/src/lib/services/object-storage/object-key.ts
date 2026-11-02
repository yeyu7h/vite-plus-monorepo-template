import { z } from 'zod'

/** Keep keys usable both by S3 and by HTTP image URLs without path normalization. */
export const objectKeySchema = z.string().refine((key) => {
  return (
    key.length > 0 &&
    Buffer.byteLength(key) <= 1024 &&
    !key.startsWith('/') &&
    !key.includes('\\') &&
    !Array.from(key).some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127) &&
    !key.split('/').some((part) => part === '.' || part === '..')
  )
}, '对象文件路径无效')
