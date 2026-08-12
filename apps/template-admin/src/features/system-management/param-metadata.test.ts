import { describe, expect, test } from 'vite-plus/test'

import { formatParamValue, getDefaultParamValue, getParamStatusMetadata, getParamValueError, getParamValueTypeMetadata, paramStatusOptions, paramValueTypeOptions } from './param-metadata'

describe('system parameter metadata', () => {
  test('provides labels for every OpenAPI parameter enum value', () => {
    expect(paramValueTypeOptions.map(({ value }) => value)).toEqual(['STRING', 'NUMBER', 'BOOLEAN', 'JSON'])
    expect(paramStatusOptions.map(({ value }) => value)).toEqual(['ENABLED', 'DISABLED'])
    expect(getParamValueTypeMetadata('JSON').label).toBe('JSON')
    expect(getParamStatusMetadata('ENABLED').color).toBe('success')
  })

  test('validates values according to their declared type', () => {
    expect(getParamValueError('STRING', 'hello')).toBeUndefined()
    expect(getParamValueError('NUMBER', '12.5')).toBeUndefined()
    expect(getParamValueError('NUMBER', 'Infinity')).toBe('请输入有限数字')
    expect(getParamValueError('BOOLEAN', 'true')).toBeUndefined()
    expect(getParamValueError('BOOLEAN', 'yes')).toBe('布尔值只能是 true 或 false')
    expect(getParamValueError('JSON', '{"enabled":true}')).toBeUndefined()
    expect(getParamValueError('JSON', '{enabled:true}')).toBe('请输入合法 JSON')
  })

  test('formats valid JSON and preserves invalid input for correction', () => {
    expect(formatParamValue('JSON', '{"enabled":true}')).toBe('{\n  "enabled": true\n}')
    expect(formatParamValue('JSON', '{enabled:true}')).toBe('{enabled:true}')
    expect(formatParamValue('STRING', '  keep spaces  ')).toBe('  keep spaces  ')
  })

  test('uses editor-safe defaults for structured values', () => {
    expect(getDefaultParamValue('STRING')).toBe('')
    expect(getDefaultParamValue('NUMBER')).toBe('')
    expect(getDefaultParamValue('BOOLEAN')).toBe('false')
    expect(getDefaultParamValue('JSON')).toBe('{}')
  })
})
