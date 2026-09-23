import { isAbsolute, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv, mergeConfig, type ConfigEnv, type UserConfig } from 'vite-plus'
import Vue from '@vitejs/plugin-vue'
import VueJsx from '@vitejs/plugin-vue-jsx'
import VueRouter from 'vue-router/vite'
import NuxtUI from '@nuxt/ui/vite'
import Tailwindcss from '@tailwindcss/vite'
import Layouts from 'vite-plugin-vue-layouts-next'
import { viteInjectAppConfigPlugin } from '@monorepo/vite-plugin-app-config'
import { viteInjectAppLoadingPlugin, type InjectAppLoadingPluginOptions } from '@monorepo/vite-plugin-app-loading'

export interface AdminConfigContext extends ConfigEnv {
  root: string
  env: Record<string, string>
}

type AdminViteOverrides = Omit<UserConfig, 'root' | 'envDir'>

export interface AdminConfigOptions {
  /** Absolute application directory or a file URL, normally new URL('.', import.meta.url). */
  root: string | URL
  nuxtUI?: Parameters<typeof NuxtUI>[0]
  layouts?: Parameters<typeof Layouts>[0]
  loading?: Omit<InjectAppLoadingPluginOptions, 'env' | 'isBuild' | 'root'>
  vite?: AdminViteOverrides | ((context: AdminConfigContext) => AdminViteOverrides | Promise<AdminViteOverrides>)
}

/** Compose the admin plugins while keeping application choices at the call site. */
export function defineAdminConfig(options: AdminConfigOptions) {
  const root = options.root instanceof URL ? fileURLToPath(options.root) : options.root
  if (!isAbsolute(root)) throw new Error('defineAdminConfig requires an absolute application root')

  return defineConfig(async (context) => {
    const env = loadEnv(context.mode, root)
    const isBuild = context.command === 'build'
    const overrides = typeof options.vite === 'function' ? await options.vite({ ...context, root, env }) : options.vite

    const config: UserConfig = {
      root,
      plugins: [
        await viteInjectAppConfigPlugin({ env, isBuild, root }),
        await viteInjectAppLoadingPlugin({ ...options.loading, env, isBuild, root }),
        VueRouter(),
        Vue(),
        VueJsx(),
        Layouts({ layoutsDirs: 'src/layouts', defaultLayout: 'Basic', ...options.layouts }),
        Tailwindcss(),
        NuxtUI(options.nuxtUI),
      ],
      resolve: {
        alias: {
          '@': resolve(root, 'src'),
          '#': resolve(root, 'src/types'),
        },
        dedupe: ['vue', 'vue-router'],
      },
      server: { host: '0.0.0.0' },
    }

    return mergeConfig(config, overrides ?? {})
  })
}
