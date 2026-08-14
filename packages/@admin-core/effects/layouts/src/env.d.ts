// oxlint-disable typescript/no-empty-object-type
/// <reference types="vite-plus/client" />
/// <reference types="@monorepo-admin-core/types/global" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}
