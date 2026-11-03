# 客户端认证接入点

通用 API 模板保留 public、client、admin 三层路由。管理端有独立账号、JWT audience／issuer、会话和 RBAC。客户端业务账号由具体应用定义，不使用管理端账号登录客户端。

默认 `src/routes/client/_middleware.ts` 调用 `createClientAuthentication()`，所有客户端接口均拒绝未配置的认证，包括携带管理端 Token 的请求。模板不提供客户端登录、刷新、用户信息或自动注册接口；通知 SSE 保留为接入认证后的示例。

业务应用在自己的中间件中注入认证函数：

```ts
import { defineMiddleware } from '@monorepo/server-core'
import { createClientAuthentication } from '@/middlewares/client-authenticate'
import { authenticateClient } from '@/business/auth'

export default defineMiddleware([createClientAuthentication(authenticateClient)])
```

`authenticateClient(token)` 返回 `Promise<{ payload: ClientJwtPayload }>`，其中 `payload.sub` 为业务用户 ID。返回值是经过验证的身份，不是客户端直接提交的数据。

使用 JWT 时，业务适配器负责签名、过期时间及专属 audience／issuer 校验，并使用区别于管理端的密钥；应用还应按自己的会话策略检查会话有效性、撤销状态与业务账号状态。适配器通过 `ClientAuthError` 拒绝无效凭证（401）或禁用账号（403），其他服务异常返回 503。

登录、刷新等公开入口由业务应用显式注册及豁免。默认认证中间件不会根据路径名称自动放行任何请求。

微信／支付宝的完整账号隔离、平台验证及 Redis 会话实现见 [`examples/miniapp-api`](../../../examples/miniapp-api/README.md)。具体业务应先确认自己的账号模型，再接入合适的登录方式。
