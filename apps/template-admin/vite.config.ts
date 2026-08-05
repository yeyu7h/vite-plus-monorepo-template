import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite-plus'
import Vue from '@vitejs/plugin-vue'
import VueJsx from '@vitejs/plugin-vue-jsx'
import VueDevTools from 'vite-plugin-vue-devtools'
import VueRouter from 'vue-router/vite'
import NuxtUI from '@nuxt/ui/vite'
import Tailwindcss from '@tailwindcss/vite'
import Layouts from 'vite-plugin-vue-layouts-next'

export default defineConfig({
  plugins: [
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
        formField: {
          slots: {
            container: 'pb-4',
            error: 'absolute mt-0.5 text-xs text-end',
          },
        },
      },
      scanPackages: ['@monorepo-admin-core/layout-ui', '@monorepo-admin-core/tabs-ui', '@monorepo-admin-core/layout-effect'],
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
})
