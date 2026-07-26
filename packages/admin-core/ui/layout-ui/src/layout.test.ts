import { describe, expect, test } from 'vite-plus/test'
import { isDocumentScrollLayout, resolveLayoutContentBodyClass, resolveLayoutGroupClass, resolveLayoutHeaderClass, resolveLayoutSidebarClass } from './layout'

describe('layout content mode', () => {
  test('uses the normal dashboard body with the global panel scroll mode', () => {
    expect(resolveLayoutContentBodyClass()).toBe('relative')
    expect(resolveLayoutContentBodyClass('default', 'panel')).toBe('relative')
    expect(isDocumentScrollLayout('default', 'panel')).toBe(false)
    expect(resolveLayoutGroupClass('default', 'panel')).toBeUndefined()
    expect(resolveLayoutSidebarClass('default', 'panel')).toBeUndefined()
  })

  test('moves normal-page scrolling to the document when configured globally', () => {
    const bodyClasses = resolveLayoutContentBodyClass('default', 'document').split(' ')
    const groupClasses = resolveLayoutGroupClass('default', 'document')?.split(' ')
    const sidebarClasses = resolveLayoutSidebarClass('default', 'document')?.split(' ')

    expect(isDocumentScrollLayout('default', 'document')).toBe(true)
    expect(bodyClasses).toContain('overflow-y-visible')
    expect(bodyClasses).not.toContain('overflow-y-auto')
    expect(groupClasses).toEqual(expect.arrayContaining(['static', 'inset-auto', 'min-h-svh', 'overflow-visible']))
    expect(sidebarClasses).toEqual(expect.arrayContaining(['lg:fixed', 'lg:inset-y-0', 'lg:start-0', 'lg:z-30', 'lg:h-svh']))
  })

  test('lets full content own its space regardless of the global scroll mode', () => {
    const classes = resolveLayoutContentBodyClass('full', 'document').split(' ')

    expect(classes).toEqual(expect.arrayContaining(['min-h-0', 'gap-0', 'overflow-hidden', 'p-0', 'sm:gap-0', 'sm:p-0']))
    expect(isDocumentScrollLayout('full', 'document')).toBe(false)
    expect(resolveLayoutGroupClass('full', 'document')).toBeUndefined()
    expect(resolveLayoutSidebarClass('full', 'document')).toBeUndefined()
  })

  test('makes the complete header sticky only for document-scrolling normal pages', () => {
    expect(resolveLayoutHeaderClass('default', 'document', true).split(' ')).toEqual(expect.arrayContaining(['sticky', 'top-0', 'z-20', 'shrink-0', 'bg-default']))
    expect(resolveLayoutHeaderClass('default', 'document', false)).toBe('shrink-0')
    expect(resolveLayoutHeaderClass('default', 'panel', true)).toBe('shrink-0')
    expect(resolveLayoutHeaderClass('full', 'document', true)).toBe('shrink-0')
  })
})
