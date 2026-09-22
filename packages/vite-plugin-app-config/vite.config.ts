import { defineNodeLibraryConfig } from '@monorepo/vite-config'

export default defineNodeLibraryConfig({
  pack: {
    entry: 'src/index.ts',
  },
})
