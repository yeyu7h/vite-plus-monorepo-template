/// <reference types="vite-plus/client" />

export {}

declare global {
  // eslint-disable-next-line ts/consistent-type-definitions
  // oxlint-disable-next-line typescript/no-explicit-any
  interface ParamsType<T = any> {
    [key: string]: T
  }
}
