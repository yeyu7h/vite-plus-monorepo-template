import { describe, expect, test } from 'vite-plus/test'
import { defaultThemePreferences, parseThemePreferences } from './theme-preferences'

describe('theme preferences', () => {
  test('restores a saved theme', () => {
    expect(parseThemePreferences('{"primary":"violet","radius":"rounded"}')).toEqual({ primary: 'violet', radius: 'rounded' })
  })

  test('falls back safely when persisted settings are invalid', () => {
    expect(parseThemePreferences('{broken')).toEqual(defaultThemePreferences)
    expect(parseThemePreferences('{"primary":"unknown","radius":"rounded"}')).toEqual({ primary: 'green', radius: 'rounded' })
  })
})
