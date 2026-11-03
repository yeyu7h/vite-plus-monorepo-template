// oxlint-disable typescript/no-empty-object-type
// Keep this declaration in a script file so TypeScript recognizes Vue modules / 将此声明保留在脚本文件中，以便 TypeScript 识别 Vue 模块
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, unknown>
  export default component
}
