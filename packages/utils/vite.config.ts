import { defineLibraryConfig } from '@monorepo/build-config'

export default defineLibraryConfig({
  pack: {
    entry: ['src/index.ts', 'src/node.ts'],
  },
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {},
})
