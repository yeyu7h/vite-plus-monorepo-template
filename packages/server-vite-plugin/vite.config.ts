import { defineConfig } from 'vite-plus'

export default defineConfig({
  pack: {
    dts: { tsgo: false },
    entry: {
      index: 'src/index.ts',
      build: 'src/vite-plugin-build/index.ts',
      'bull-board-static': 'src/vite-plugin-bull-board-static/index.ts',
      'hmr-notify': 'src/vite-plugin-hmr-notify/index.ts',
      'resource-monitor': 'src/vite-plugin-resource-monitor/index.ts',
      'zod-hoist': 'src/vite-plugin-zod-hoist/index.ts',
    },
    format: 'esm',
    outExtensions: () => ({ dts: '.d.ts', js: '.mjs' }),
    platform: 'node',
  },
})
