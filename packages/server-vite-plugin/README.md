# @monorepo/server-vite-plugin

服务端 Vite 插件集合：build、Bull Board static、HMR notify、resource monitor 和 Zod hoist。

构建插件的优雅关闭目标必须显式配置：

```ts
gracefulShutdown: {
  module: '/src/lib/infrastructure/bootstrap.ts',
  exportName: 'shutdown',
  timeoutMs: 10_000,
}
```
