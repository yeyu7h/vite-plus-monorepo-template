import type { ZodSchema } from './types.ts'
import type { ReferenceObject, SchemaObject } from 'openapi3-ts/oas30'

import { OpenApiGeneratorV3, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

export type GeneratedOpenApiSchema = SchemaObject | ReferenceObject

const oneOf = <T extends ZodSchema>(schemas: T[]): GeneratedOpenApiSchema[] => {
  const registry = new OpenAPIRegistry()

  schemas.forEach((schema, index) => {
    registry.register(index.toString(), schema)
  })

  const generator = new OpenApiGeneratorV3(registry.definitions)
  const components = generator.generateComponents()

  return components.components?.schemas ? Object.values(components.components!.schemas!) : []
}

export default oneOf
