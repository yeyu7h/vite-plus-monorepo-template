import { defineConfig } from 'vite-plus'

export default defineConfig({
  pack: {
    dts: {
      tsgo: false,
    },
    entry: ['src/index.ts'],
    format: 'esm',
    outExtensions: () => ({ dts: '.d.ts', js: '.mjs' }),
  },
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {},
})
