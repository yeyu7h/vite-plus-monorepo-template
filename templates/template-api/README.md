# @app/template-api

从 Clhoria Template 迁入并适配 Vite+ monorepo 的 Hono 后端。

保留 OpenAPI/Scalar、Drizzle PostgreSQL、Redis、BullMQ、Casbin RBAC、S3、Cap.js、Effect、迁移脚本与 Docker 能力。公共 API 位于 `/api/*`，客户端 API 位于 `/api/client/*`，管理 API 位于 `/api/admin/*`，默认端口为 `9999`。

Scalar 首页位于 `/`，三组 OpenAPI JSON 分别位于 `/api/doc`、`/api/client/doc` 和 `/api/admin/doc`。

默认模板提供管理端账号与认证，不预设客户端的业务用户表、注册方式、UID 或资料生成规则。客户端认证接入方式见 [客户端认证](docs/client-auth.md)。微信、支付宝的完整业务实现已迁至独立的 [小程序示例](../../examples/miniapp-api/README.md)。

对象存储通过 `STORAGE_PROVIDER=none|r2|rustfs` 关闭或选择服务。新应用示例配置为 `none`，省略该变量时保持旧版 R2 行为。RustFS 可选部署、公开图片域名和服务端上传方法见 [对象存储](docs/object-storage.md)。

## 本地启动

从仓库根目录执行：

```bash
vp install
cp templates/template-api/.env.example templates/template-api/.env
vp run @app/template-api#dev
```

启动前填写至少 32 字符的随机 `ADMIN_JWT_SECRET`。本地运行 PostgreSQL/Redis 时，请将 `.env` 中服务主机名从 `postgres`/`redis` 改为 `localhost`。如使用 Compose，保留默认服务名即可。配置校验与存活、就绪检查见 [运行配置](docs/runtime.md)。

## 数据库与测试

当前初始迁移只面向新数据库。原有迁移历史完整保存在小程序示例中，已有数据库继续使用原来的迁移链，见 [迁移边界](migrations/README.md)。本模板的迁移不会为已有数据库执行小程序表清理。

```bash
vp run @app/template-api#generate
vp run @app/template-api#migrate
vp run @app/template-api#push
vp run @app/template-api#seed
vp run @app/template-api#test
vp run @app/template-api#test:integration
vp run @app/template-api#test:storage
```

`test` 默认排除 `*.integration.test.ts`；集成测试需要专用 PostgreSQL、Redis，以及已执行的迁移和 seed。必须显式设置 `TEST_DATABASE_URL`、`TEST_REDIS_URL`，缺少地址会在加载测试前终止。

`test:storage` 独立使用专用 RustFS；必须显式设置 `TEST_STORAGE_ENDPOINT`、`TEST_STORAGE_ACCESS_KEY_ID`、`TEST_STORAGE_SECRET_ACCESS_KEY`、`TEST_STORAGE_BUCKET_NAME`，默认测试和数据库集成测试均不连接对象存储。配置选择日志不进行网络探测。

## 可复用边界

框架级能力位于 `@monorepo/server-core`，Refine 查询位于 `@monorepo/server-refine-query`，Vite 服务端插件位于 `@monorepo/server-vite-plugin`，纯工具位于 `@monorepo/utils`。数据库连接、日志、Redis/BullMQ、Casbin 与可配置对象存储保持在 app 内；具体业务应用管理自己的用户、注册和客户端会话。

后续创建 API app 时，应显式向 `createApplication(config, runtime)` 提供环境、版本、route/middleware globs 和 app 根 Hono 实例。

## 来源

本 app 基于 Clhoria Template 重构。版权和 MIT 许可见仓库根目录 `THIRD_PARTY_NOTICES.md`。
