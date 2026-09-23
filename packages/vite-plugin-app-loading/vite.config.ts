import { defineNodeLibraryConfig } from '@monorepo/build-config'

export default defineNodeLibraryConfig({
  pack: {
    entry: {
      index: 'src/index.ts',
      runtime: 'src/runtime.ts',
    },
  },
})
