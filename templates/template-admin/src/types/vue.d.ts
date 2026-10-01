// oxlint-disable typescript/no-empty-object-type
// Keep this declaration in a script file so TypeScript recognizes Vue modules.
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}
