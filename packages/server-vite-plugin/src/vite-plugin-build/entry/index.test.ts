import { describe, expect, it, vi } from 'vite-plus/test'

import { getEntryContent } from './index.ts'

describe('getEntryContent', () => {
  it('awaits hooks and embeds the caller-provided graceful shutdown import', async () => {
    const beforeHook = vi.fn<() => Promise<string>>(async () => "import { shutdown } from '/src/runtime.ts'")
    const afterHook = vi.fn<() => string>(() => 'await shutdown()')

    const content = await getEntryContent({
      entry: ['src/index.ts'],
      entryContentBeforeHooks: [beforeHook],
      entryContentAfterHooks: [afterHook],
    })

    expect(content).toContain("import { shutdown } from '/src/runtime.ts'")
    expect(content).toContain('await shutdown()')
    expect(beforeHook).toHaveBeenCalledOnce()
    expect(afterHook).toHaveBeenCalledOnce()
  })

  it('normalizes entry paths for import.meta.glob', async () => {
    const content = await getEntryContent({
      entry: ['./src/index.ts'],
      wrapWithMainApp: true,
    })

    expect(content).toContain("import.meta.glob(['/src/index.ts']")
  })
})
