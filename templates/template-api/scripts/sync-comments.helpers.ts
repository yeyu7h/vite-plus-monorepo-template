type AstCallee = {
  type?: string
  name?: string
  object?: AstCallee
  property?: AstCallee
  computed?: boolean
}

/**
 * Match the supported Drizzle PostgreSQL table declaration factories.
 *
 * `pgTable(...)` remains supported for schemas without casing conversion, while
 * this project's schemas use `snakeCase.table(...)`.
 */
export function isTableDeclarationCall(callee: AstCallee): boolean {
  if (callee.type === 'Identifier') return callee.name === 'pgTable'

  return (
    callee.type === 'MemberExpression' &&
    callee.computed === false &&
    callee.object?.type === 'Identifier' &&
    callee.object.name === 'snakeCase' &&
    callee.property?.type === 'Identifier' &&
    callee.property.name === 'table'
  )
}

/** Find runtime table exports that were not recognized in the source AST. */
export function findMissingTableDeclarations(sourceTableNames: Iterable<string>, runtimeTableNames: Iterable<string>): string[] {
  const sourceNames = new Set(sourceTableNames)
  return [...runtimeTableNames].filter((name) => !sourceNames.has(name)).sort()
}
