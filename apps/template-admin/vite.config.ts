import { defineConfig, loadEnv } from 'vite-plus'
import { fileURLToPath, URL } from 'node:url'
import Vue from '@vitejs/plugin-vue'
import VueJsx from '@vitejs/plugin-vue-jsx'
import VueDevTools from 'vite-plugin-vue-devtools'
import VueRouter from 'vue-router/vite'
import NuxtUI from '@nuxt/ui/vite'
import Tailwindcss from '@tailwindcss/vite'
import Layouts from 'vite-plugin-vue-layouts-next'
import { viteInjectAppLoadingPlugin } from '@monorepo/vite-plugin-app-loading'

const appRoot = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig(async ({ command, mode }) => {
  const env = loadEnv(mode, appRoot)

  return {
    plugins: [
      await viteInjectAppLoadingPlugin({ env, isBuild: command === 'build', root: appRoot, themeStorageKey: 'vueuse-color-scheme' }),

      VueRouter(),
      Vue(),
      VueJsx(),
      Layouts({
        layoutsDirs: 'src/layouts',
        defaultLayout: 'Basic',
      }),
      Tailwindcss(),
      NuxtUI({
        ui: {
          colors: { neutral: 'neutral' },
          dropdownMenu: {
            slots: {
              content: 'z-20',
            },
          },
          drawer: {
            slots: {
              content: 'z-50',
              overlay: 'z-40',
            },
          },
          formField: {
            slots: {
              container: 'pb-4',
              error: 'absolute mt-0.5 text-xs text-end',
            },
          },
          modal: {
            slots: {
              content: 'z-50',
              overlay: 'z-40',
            },
          },
          slideover: {
            slots: {
              content: 'z-50',
              overlay: 'z-40',
            },
          },
        },
        scanPackages: ['@monorepo-admin-core/common-ui', '@monorepo-admin-core/layout-ui', '@monorepo-admin-core/tabs-ui', '@monorepo-admin-core/layout-effect'],
      }),
      VueDevTools(),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        '#': fileURLToPath(new URL('./src/types', import.meta.url)),
      },
      dedupe: ['vue', 'vue-router'],
    },
    server: {
      host: '0.0.0.0',
      proxy: {
        '/api': 'http://localhost:9999',
      },
    },
  }
})
