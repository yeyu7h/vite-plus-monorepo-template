import { defineLibraryConfig } from '@monorepo/build-config'

export default defineLibraryConfig({
  pack: {
    entry: 'src/index.ts',
    unbundle: true,
    platform: 'neutral',
  },
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {},
})
