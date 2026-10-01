// oxlint-disable typescript/no-empty-object-type
declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent<{}, {}, unknown>
  export default component
}
