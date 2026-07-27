import type { ZodSchema } from './types.ts'
import type { GeneratedOpenApiSchema } from './one-of.ts'

import oneOf from './one-of.js'

type JsonContentOneOf = {
  content: {
    'application/json': {
      schema: {
        oneOf: GeneratedOpenApiSchema[]
      }
    }
  }
  description: string
}

const jsonContentOneOf = <T extends ZodSchema>(schemas: T[], description: string): JsonContentOneOf => {
  return {
    content: {
      'application/json': {
        schema: {
          oneOf: oneOf(schemas),
        },
      },
    },
    description,
  }
}

export default jsonContentOneOf
