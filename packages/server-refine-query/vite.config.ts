import { defineNodeLibraryConfig } from '@monorepo/build-config'

export default defineNodeLibraryConfig({
  pack: {
    entry: ['src/index.ts'],
  },
})
