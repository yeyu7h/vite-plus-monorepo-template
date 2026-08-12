import { describe, expect, test } from 'vite-plus/test'

import { menuAccessScopeMetadata, menuAccessScopeOptions, menuStatusMetadata, menuStatusOptions, menuTypeFallbackIcons, menuTypeMetadata, menuTypeOptions } from './menu-metadata'

describe('menu enum metadata', () => {
  test('builds menu type options from the OpenAPI-constrained metadata map', () => {
    expect(menuTypeOptions.map(({ value }) => value)).toEqual(['group', 'directory', 'menu', 'button'])
    expect(menuTypeOptions.map(({ label }) => label)).toEqual(['分组', '目录', '菜单', '按钮'])
    expect(menuTypeOptions.every((option) => !('icon' in option))).toBe(true)
    expect(menuTypeMetadata.menu.color).toBe('primary')
    expect(menuTypeFallbackIcons.menu).toBe('i-lucide-file')
  })

  test('keeps status and access options aligned with their display metadata', () => {
    expect(menuStatusOptions.map(({ value, label }) => ({ value, label }))).toEqual([
      { value: 'ENABLED', label: '启用' },
      { value: 'DISABLED', label: '禁用' },
    ])
    expect(menuAccessScopeOptions.map(({ value, label }) => ({ value, label }))).toEqual([
      { value: 'restricted', label: '受限' },
      { value: 'public', label: '公共' },
    ])
    expect(menuStatusMetadata.ENABLED).not.toHaveProperty('icon')
    expect(menuAccessScopeMetadata.restricted).not.toHaveProperty('icon')
  })
})
