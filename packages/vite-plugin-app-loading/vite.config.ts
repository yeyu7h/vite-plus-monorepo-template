import { defineNodeLibraryConfig } from '@monorepo/vite-config'

export default defineNodeLibraryConfig({
  pack: {
    entry: {
      index: 'src/index.ts',
      runtime: 'src/runtime.ts',
    },
  },
})
