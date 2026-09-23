import { defineAdminConfig } from '@monorepo/vite-config'

export default defineAdminConfig({
  root: new URL('.', import.meta.url),
  loading: { themeStorageKey: 'vueuse-color-scheme' },
  nuxtUI: {
    ui: {
      colors: { neutral: 'neutral' },
      dropdownMenu: {
        slots: {
          content: 'z-60',
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
      select: {
        slots: {
          content: 'z-60',
        },
      },
      selectMenu: {
        slots: {
          content: 'z-60',
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
  },
  vite: {
    server: {
      proxy: {
        '/api': 'http://localhost:9999',
      },
    },
  },
})
