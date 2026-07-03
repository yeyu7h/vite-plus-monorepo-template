import { defineConfig } from 'vite-plus'

export default defineConfig({
  pack: {
    dts: { tsgo: false },
    entry: {
      'utils/index': 'src/utils/index.ts',
    },
    platform: 'neutral',
    format: 'esm',
    outExtensions: () => ({ dts: '.d.ts', js: '.mjs' }),
  },
})
