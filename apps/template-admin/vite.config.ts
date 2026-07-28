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
    Vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) => tag === 'cap-widget',
        },
      },
    }),
    VueJsx(),
    Layouts({
      layoutsDirs: 'src/layouts',
      defaultLayout: 'Basic',
    }),
    Tailwindcss(),
    NuxtUI({
      ui: { colors: { neutral: 'neutral' } },
      autoImport: false,
      scanPackages: ['@monorepo-admin-core/layout-ui', '@monorepo-admin-core/tabs-ui', '@monorepo-admin-core/layout-effect'],
    }),
    VueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
    dedupe: ['vue', 'vue-router'],
  },
  server: {
    proxy: {
      '/api': {
        changeOrigin: true,
        target: 'http://localhost:10000',
      },
    },
  },
})
