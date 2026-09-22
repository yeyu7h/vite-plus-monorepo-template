import { defineLibraryConfig } from '@monorepo/vite-config'

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
