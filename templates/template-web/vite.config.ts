import { defineWebConfig } from '@monorepo/vite-config'

export default defineWebConfig({
  root: new URL('.', import.meta.url),
  nuxtUI: { ui: { colors: { primary: 'indigo', neutral: 'zinc' } } },
  vite: {
    server: {
      port: 5174,
      proxy: { '/api': 'http://localhost:9999' },
    },
  },
})
