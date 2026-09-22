import { defineLibraryConfig } from '@monorepo/vite-config'

export default defineLibraryConfig({
  pack: {
    entry: {
      'utils/index': 'src/utils/index.ts',
    },
    platform: 'neutral',
  },
})
