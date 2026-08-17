import { defineConfig } from 'vite-plus'

export default defineConfig({
  pack: {
    dts: { tsgo: false },
    entry: 'src/index.ts',
    unbundle: true,
    platform: 'neutral',
    format: 'esm',
    outExtensions: () => ({ dts: '.d.ts', js: '.mjs' }),
  },
})
