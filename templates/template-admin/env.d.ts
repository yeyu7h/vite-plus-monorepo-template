// oxlint-disable typescript/no-empty-object-type
/// <reference types="vite-plus/client" />

import type { AdminAppConfigRaw } from '@monorepo-admin-core/types/global'

declare global {
  interface ImportMetaEnv extends AdminAppConfigRaw {}
}
