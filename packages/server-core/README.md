# @monorepo/server-core

可复用的 Hono 服务端基础包，导出 bindings/tier 类型、router/factory helpers、HTTP 状态码、OpenAPI helpers、`Resp`、singleton 生命周期、`defineConfig<TEnv>()` 和 `createApplication(config, runtime)`。

调用方必须显式提供 `env`、版本号、routes、middlewares 和 app 根 Hono 实例；业务日志、限流、错误处理等策略由 app 自己组装。

```bash
vp run @monorepo/server-core#test
vp run @monorepo/server-core#build
```

部分代码源自 Clhoria Template，许可见仓库根目录 `THIRD_PARTY_NOTICES.md`。
