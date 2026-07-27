# @app/template-api

从 Clhoria Template 迁入并适配 Vite+ monorepo 的 Hono 后端。

保留 OpenAPI/Scalar、Drizzle PostgreSQL、Redis、BullMQ、Casbin RBAC、S3、Cap.js、Effect、迁移脚本与 Docker 能力。公共 API 位于 `/api/*`，客户端 API 位于 `/api/client/*`，管理 API 位于 `/api/admin/*`，默认端口为 `9999`。

Scalar 首页位于 `/`，三组 OpenAPI JSON 分别位于 `/api/doc`、`/api/client/doc` 和 `/api/admin/doc`。

## 本地启动

从仓库根目录执行：

```bash
vp install
cp apps/template-api/.env.example apps/template-api/.env
vp run @app/template-api#dev
```

本地运行 PostgreSQL/Redis 时，请将 `.env` 中服务主机名从 `postgres`/`redis` 改为 `localhost`。如使用 Compose，保留默认服务名即可。

## 数据库与测试

```bash
vp run @app/template-api#generate
vp run @app/template-api#migrate
vp run @app/template-api#push
vp run @app/template-api#seed
vp run @app/template-api#test
vp run @app/template-api#test:integration
```

`test` 默认排除 `*.integration.test.ts`；集成测试需要可用的 PostgreSQL、Redis、测试环境变量和已执行的迁移。

## 可复用边界

框架级能力位于 `@monorepo/server-core`，Refine 查询位于 `@monorepo/server-refine-query`，Vite 服务端插件位于 `@monorepo/server-vite-plugin`，纯工具位于 `@monorepo/utils`。数据库连接、业务 Schema、日志、Redis/BullMQ 与 Casbin 保持在 app 内。

后续创建 API app 时，应显式向 `createApplication(config, runtime)` 提供环境、版本、route/middleware globs 和 app 根 Hono 实例。

## 来源

本 app 基于 Clhoria Template 重构。版权和 MIT 许可见仓库根目录 `THIRD_PARTY_NOTICES.md`。
