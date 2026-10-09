import { defineAdminConfig } from '@monorepo/vite-config'

// Menu groups add 0.25rem padding; the item highlight is inset another 1px.
const insetMenuItemRadius = 'before:rounded-[max(0px,calc(var(--radius-lg)_-_0.25rem_-_1px))]'

export default defineAdminConfig({
  root: new URL('.', import.meta.url),
  loading: { themeStorageKey: 'vueuse-color-scheme' },
  nuxtUI: {
    ui: {
      colors: { neutral: 'neutral' },
      contextMenu: {
        slots: {
          content: 'rounded-lg',
          item: insetMenuItemRadius,
        },
      },
      dropdownMenu: {
        slots: {
          content: 'z-60 rounded-lg',
          item: insetMenuItemRadius,
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
      inputMenu: {
        slots: {
          content: 'rounded-lg',
          item: insetMenuItemRadius,
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
          content: 'z-60 rounded-lg',
          item: insetMenuItemRadius,
        },
      },
      selectMenu: {
        slots: {
          content: 'z-60 rounded-lg',
          item: insetMenuItemRadius,
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
