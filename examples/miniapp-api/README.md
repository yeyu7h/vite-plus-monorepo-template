# @example/miniapp-api

从原 API 模板拆出的完整小程序业务示例，包名为 `@example/miniapp-api`。它独立参与工作区检查、测试和构建，不会由 `create:app -- api` 自动复制。

本示例保留独立业务账号、微信／支付宝平台身份、UID 分配及 Redis 会话。平台验证由 `@monorepo/server-miniapp-auth` 提供；业务 UID 规则与测试在本示例的 `src/lib/services/client-auth/uid.ts` 中。

此前新增的随机昵称、森林动物头像、素材及头像接口已撤销。当前首次注册沿用 `用户<UID>` 和空头像，DiceBear 留待后续业务实现。

保留 OpenAPI/Scalar、Drizzle PostgreSQL、Redis、BullMQ、Casbin RBAC、S3、Cap.js、Effect、迁移脚本与 Docker 能力。公共 API 位于 `/api/*`，客户端 API 位于 `/api/client/*`，管理 API 位于 `/api/admin/*`，默认端口为 `9999`。

Scalar 首页位于 `/`，三组 OpenAPI JSON 分别位于 `/api/doc`、`/api/client/doc` 和 `/api/admin/doc`。

微信、支付宝小程序共用业务用户表及固定前缀 UID，业务账号与后台管理账号独立。接入配置、接口和原生调用示例见 [小程序登录](docs/miniapp-auth.md)。

对象存储通过 `STORAGE_PROVIDER=r2|rustfs` 选择，默认兼容现有 R2 配置。RustFS 可选部署、公开图片域名和服务端上传方法见 [对象存储](docs/object-storage.md)。

## 本地启动

从仓库根目录执行：

```bash
vp install
cp examples/miniapp-api/.env.example examples/miniapp-api/.env
vp run @example/miniapp-api#dev
```

本地运行 PostgreSQL/Redis 时，请将 `.env` 中服务主机名从 `postgres`/`redis` 改为 `localhost`。如使用 Compose，保留默认服务名即可。

独立运行本示例时使用专用数据库和 Redis，并按需设置独立 `PORT`；同时运行通用模板时，两者不能共用默认端口或测试服务。本示例未复制原模板的本地 `.env` 或真实平台凭据。

## 数据库与测试

历史迁移 SQL 与快照原样保留，具体边界见 [迁移说明](migrations/README.md)。真实微信／支付宝授权仍需有效应用配置及小程序客户端联调，平台替身测试不代表真实授权成功。

```bash
vp run @example/miniapp-api#generate
vp run @example/miniapp-api#migrate
vp run @example/miniapp-api#push
vp run @example/miniapp-api#seed
vp run @example/miniapp-api#test
vp run @example/miniapp-api#test:integration
vp run @example/miniapp-api#test:storage
```

`test` 默认排除 `*.integration.test.ts`；集成测试需要专用 PostgreSQL、Redis，以及已执行的迁移和 seed。必须显式设置 `TEST_DATABASE_URL`、`TEST_REDIS_URL`，缺少地址会在加载测试前终止。

角色、用户和 Refine 查询执行器的共同测试契约维护在 [`internal/api-test-suite`](../../internal/api-test-suite/README.md)，应用内的测试入口负责注入本应用的依赖与数据清理。

`test:storage` 独立使用专用 RustFS；必须显式设置 `TEST_STORAGE_ENDPOINT`、`TEST_STORAGE_ACCESS_KEY_ID`、`TEST_STORAGE_SECRET_ACCESS_KEY`、`TEST_STORAGE_BUCKET_NAME`，默认测试和数据库集成测试均不连接对象存储。配置选择日志不进行网络探测。

## 可复用边界

框架级能力位于 `@monorepo/server-core`，Refine 查询位于 `@monorepo/server-refine-query`，小程序平台身份验证位于 `@monorepo/server-miniapp-auth`，Vite 服务端插件位于 `@monorepo/server-vite-plugin`，纯工具位于 `@monorepo/utils`。数据库连接、业务 Schema、账号注册、会话、日志、Redis/BullMQ 与 Casbin 保持在 app 内。

后续创建 API app 时，应显式向 `createApplication(config, runtime)` 提供环境、版本、route/middleware globs 和 app 根 Hono 实例。

## 来源

本 app 基于 Clhoria Template 重构。版权和 MIT 许可见仓库根目录 `THIRD_PARTY_NOTICES.md`。
