import { defineConfig, type UserConfig } from 'vite-plus'
import type { PackUserConfig } from 'vite-plus/pack'
import Vue from 'unplugin-vue/rolldown'

type LibraryConfig = Omit<UserConfig, 'pack'> & { pack?: PackUserConfig }

/** Overrides replace individual pack fields, including arrays and nested options. */
export function defineLibraryConfig({ pack, ...config }: LibraryConfig = {}): UserConfig {
  return defineConfig({
    ...config,
    pack: {
      dts: { tsgo: false },
      format: 'esm',
      outExtensions: () => ({ dts: '.d.ts', js: '.mjs' }),
      ...pack,
    },
  })
}

export function defineNodeLibraryConfig({ pack, ...config }: LibraryConfig = {}): UserConfig {
  return defineLibraryConfig({ ...config, pack: { platform: 'node', ...pack } })
}

export function defineVueLibraryConfig({ pack, plugins, ...config }: LibraryConfig = {}): UserConfig {
  return defineLibraryConfig({
    ...config,
    plugins: plugins ?? [Vue()],
    pack: {
      dts: { tsgo: false, vue: true },
      entry: 'src/index.ts',
      unbundle: true,
      platform: 'neutral',
      plugins: [Vue({ isProduction: true })],
      ...pack,
    },
  })
}
