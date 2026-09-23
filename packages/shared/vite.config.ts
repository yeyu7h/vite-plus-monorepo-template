import { defineLibraryConfig } from '@monorepo/build-config'

export default defineLibraryConfig({
  pack: {
    entry: {
      'utils/index': 'src/utils/index.ts',
    },
    platform: 'neutral',
  },
})
