import { defineConfig } from 'vite-plus'

export default defineConfig({
  test: {
    name: 'vite-config',
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
