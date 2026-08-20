import { defineConfig } from 'vite-plus'

export default defineConfig({
  pack: {
    dts: { tsgo: false },
    entry: {
      index: 'src/index.ts',
      runtime: 'src/runtime.ts',
    },
    format: 'esm',
    outExtensions: () => ({ dts: '.d.ts', js: '.mjs' }),
    platform: 'node',
  },
})
