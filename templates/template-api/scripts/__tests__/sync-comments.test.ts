import { describe, expect, it } from 'vite-plus/test'

import { findMissingTableDeclarations, isTableDeclarationCall } from '../sync-comments.helpers'

describe('isTableDeclarationCall', () => {
  it('matches the current snakeCase table factory', () => {
    expect(
      isTableDeclarationCall({
        type: 'MemberExpression',
        object: { type: 'Identifier', name: 'snakeCase' },
        property: { type: 'Identifier', name: 'table' },
        computed: false,
      }),
    ).toBe(true)
  })

  it('keeps supporting direct pgTable declarations', () => {
    expect(
      isTableDeclarationCall({
        type: 'Identifier',
        name: 'pgTable',
      }),
    ).toBe(true)
  })

  it.each([
    {
      type: 'MemberExpression',
      object: { type: 'Identifier', name: 'otherFactory' },
      property: { type: 'Identifier', name: 'table' },
      computed: false,
    },
    {
      type: 'MemberExpression',
      object: { type: 'Identifier', name: 'snakeCase' },
      property: { type: 'Identifier', name: 'view' },
      computed: false,
    },
    {
      type: 'MemberExpression',
      object: { type: 'Identifier', name: 'snakeCase' },
      property: { type: 'Literal', value: 'table' },
      computed: true,
    },
  ])('rejects unrelated calls', (callee) => {
    expect(isTableDeclarationCall(callee)).toBe(false)
  })
})

describe('findMissingTableDeclarations', () => {
  it('reports runtime tables missing from the source scan', () => {
    expect(findMissingTableDeclarations(['systemUsers', 'systemRoles'], ['systemUsers', 'clientUsers', 'systemRoles'])).toEqual(['clientUsers'])
  })

  it('returns an empty list when every runtime table was recognized', () => {
    expect(findMissingTableDeclarations(['systemUsers', 'systemRoles'], ['systemRoles', 'systemUsers'])).toEqual([])
  })
})
