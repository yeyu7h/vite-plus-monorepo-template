import { z } from '@hono/zod-openapi'

// Regular expression to validate slug format: alphanumeric characters, underscores, and dashes / 校验 slug 格式的正则：字母、数字、下划线和连字符
const slugReg = /^[\w-]+$/
const SLUG_ERROR_MESSAGE = 'Slug can only contain letters, numbers, dashes, and underscores'

const SlugParamsSchema = z.object({
  slug: z
    .string()
    .regex(slugReg, SLUG_ERROR_MESSAGE)
    .openapi({
      param: {
        name: 'slug',
        in: 'path',
        required: true,
      },
      required: ['slug'],
      example: 'my-cool-article',
    }),
})

export default SlugParamsSchema
