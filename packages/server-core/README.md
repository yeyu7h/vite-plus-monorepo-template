# @monorepo/server-core

可复用的 Hono 服务端基础包，导出 bindings/tier 类型、router/factory helpers、HTTP 状态码、OpenAPI helpers、`Resp`、singleton 生命周期、`defineConfig<TEnv>()` 和 `createApplication(config, runtime)`。

调用方必须显式提供 `env`、版本号、routes、middlewares 和 app 根 Hono 实例；业务日志、限流、错误处理等策略由 app 自己组装。

Tier 中间件只在请求匹配该 tier 的已注册处理器时执行；没有匹配处理器的请求继续分发，最终由根应用的 404 处理器响应。路由模块内的通配中间件也属于已注册处理器，应按需要配置其匹配范围。公开登录等接口仍需由业务显式配置认证豁免。

```bash
vp run @monorepo/server-core#test
vp run @monorepo/server-core#build
```
