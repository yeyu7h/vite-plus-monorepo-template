import { defineLibraryConfig } from '@monorepo/vite-config'

export default defineLibraryConfig({
  pack: {
    entry: 'src/index.ts',
    unbundle: true,
    platform: 'neutral',
  },
})
