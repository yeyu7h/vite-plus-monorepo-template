# Vite+ Monorepo Template

包含 Vue 管理端与 Clhoria/Hono API 的 Vite+ monorepo 模板。

## 工作区

- `apps/template-admin`：现有管理端，保持原有 mock/API 行为。
- `apps/template-api`：Hono + OpenAPI + Drizzle + Redis + BullMQ + Casbin 后端，默认监听 `9999`。
- `packages/server-core`：Hono 类型、路由工厂、OpenAPI、响应模型、应用装配和 singleton 生命周期。
- `packages/server-refine-query`：通过依赖注入绑定 Drizzle 的 Refine 查询转换与执行器。
- `packages/server-vite-plugin`：服务端构建、Bull Board 静态资源、HMR 通知、资源监控和 Zod hoist 插件。
- `packages/utils`：与运行时无关的通用工具。

## 开发

```bash
vp install
cp apps/template-api/.env.example apps/template-api/.env
vp run dev:admin
vp run dev:api
# 或同时启动
vp run dev:all
```

API 路由分为 `/api/*`、`/api/client/*` 和 `/api/admin/*`，Scalar 文档首页位于 `http://localhost:9999/`。三组 OpenAPI 文档分别位于 `/api/doc`、`/api/client/doc` 和 `/api/admin/doc`。

常用数据库命令：

```bash
vp run api:generate
vp run api:migrate
vp run api:push
vp run api:seed
```

默认测试不依赖 PostgreSQL 或 Redis。启动外部服务并完成迁移后，可运行：

```bash
vp run @app/template-api#test:integration
```

完整验证：

```bash
vp run ready
```

## Docker

在仓库根目录运行：

```bash
cp apps/template-api/.env.example apps/template-api/.env
docker compose -f apps/template-api/compose.yaml up --build
```

Compose 使用仓库根目录作为构建上下文，并等待 PostgreSQL、Redis 和 API 健康检查。

## 来源与许可

后端 app 和部分服务端 packages 基于 Clhoria Template 集成并重构。第三方版权与 MIT 许可见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。
