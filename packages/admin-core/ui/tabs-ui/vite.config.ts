import { defineConfig } from 'vite-plus'
import Vue from 'unplugin-vue/rolldown'

export default defineConfig({
  pack: {
    dts: { tsgo: false, vue: true },
    entry: 'src/index.ts',
    unbundle: true,
    platform: 'neutral',
    format: 'esm',
    plugins: [Vue({ isProduction: true })],
    outExtensions: () => ({ dts: '.d.ts', js: '.mjs' }),
  },
})
