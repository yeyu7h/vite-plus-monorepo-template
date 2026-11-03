# Vite+ Monorepo Template

包含独立的 Vue 前台、Vue 管理端与 Clhoria/Hono API 的 Vite+ monorepo 模板。模板源码集中在 `templates/`，用命令复制到 `apps/` 创建新应用。

多业务开发、协作与发布约定见 [开发规范](docs/development.md)。

## 工作区

- `templates/template-admin`：现有管理端模板，保持原有 mock/API 行为。
- `templates/template-web`：面向普通 Web App 的前台模板，包含文件路由、Nuxt UI 和可选的公开 API 请求示例。
- `templates/template-api`：Hono + OpenAPI + Drizzle + Redis + BullMQ + Casbin 后端模板，默认监听 `9999`。
- `apps/`：通过创建命令生成的应用，仍属于同一 pnpm 工作区。
- `packages/server-core`：Hono 类型、路由工厂、OpenAPI、响应模型、应用装配和 singleton 生命周期。
- `packages/server-refine-query`：通过依赖注入绑定 Drizzle 的 Refine 查询转换与执行器。
- `packages/server-vite-plugin`：服务端构建、Bull Board 静态资源、HMR 通知、资源监控和 Zod hoist 插件。
- `packages/utils`：与运行时无关的通用工具。

## 开发

```bash
vp install
cp templates/template-api/.env.example templates/template-api/.env
vp run dev:admin
vp run dev:web
vp run dev:api
# 或同时启动
vp run dev:all
```

前台默认运行在 `http://localhost:5174`，可独立启动；只有点击首页的 API 检查时才需要运行 `template-api`。前台模板的结构和扩展说明见 [templates/template-web/README.md](./templates/template-web/README.md)。

## 从模板创建应用

```bash
vp run create:app -- web customer-web
vp run create:app -- admin customer-admin
vp run create:app -- api customer-api
vp install
vp run @app/customer-web#dev
```

可用模板为 `web`、`admin`、`api`，应用名使用小写字母、数字和连字符。命令会创建 `apps/<应用名>`，修改包名及模板内与自身名称相关的路径，并跳过依赖、构建产物和本地 `.env`。已有目录不会被覆盖。新建 API 应用时，从其 `.env.example` 复制环境文件，填写不同的随机管理端和客户端 JWT 密钥，再启动数据库与 Redis；对象存储默认显式关闭，可按需选择 R2 或 RustFS。Docker 配置中的构建路径也会指向新目录。

运行 `vp run create:app -- --list` 可查看可用模板。新应用是创建时的独立副本，之后修改 `templates/` 不会自动覆盖它。

API 路由分为 `/api/*`、`/api/client/*` 和 `/api/admin/*`，Scalar 文档首页位于 `http://localhost:9999/`。三组 OpenAPI 文档分别位于 `/api/doc`、`/api/client/doc` 和 `/api/admin/doc`。

默认 API 模板提供独立的管理端与客户端账号、微信小程序登录和客户端会话。微信应用未配置时无法平台登录，详见 [微信小程序登录](templates/template-api/docs/miniapp-auth.md)。

通用模板使用自己的数据库迁移链。原小程序应用的迁移 SQL 和快照可在 Git 历史中查阅；已有应用沿用自己的迁移历史，详见 [迁移边界](templates/template-api/migrations/README.md)。

常用数据库命令：

```bash
vp run api:generate
vp run api:migrate
vp run api:push
vp run api:seed
```

默认测试不依赖 PostgreSQL 或 Redis。为专用测试服务完成迁移和 seed 后，显式设置 `TEST_DATABASE_URL`、`TEST_REDIS_URL`，再运行：

```bash
vp run @app/template-api#test:integration
```

完整验证：

```bash
vp run ready
```

Gitea 和 GitHub 分别使用 `.gitea/workflows/ci.yml`、`.github/workflows/ci.yml`，在向 `main` 推送或提交 Pull Request 时执行同一套 `ready` 检查。两者使用 Node 24、仓库声明的 Vite+ 版本和锁文件安装依赖。自建 Gitea 需要启用仓库 Actions 并注册 Runner，配置步骤见 [持续集成](docs/ci.md)。该流程包含脚手架测试、默认单元测试与构建，不连接真实数据库、Redis 或对象存储；专用服务集成测试仍按上面的显式配置单独执行。

## Docker

在仓库根目录运行：

```bash
cp templates/template-api/.env.example templates/template-api/.env
# Fill ADMIN_JWT_SECRET and CLIENT_JWT_SECRET with different random values before starting.
docker compose --env-file templates/template-api/.env -f templates/template-api/compose.yaml up --build
```

Compose 使用仓库根目录作为构建上下文，并等待 PostgreSQL、Redis 和 API 健康检查。API 的 `/api/health` 用于进程存活检查，`/api/health/ready` 探测数据库与 Redis；容器使用后者判断就绪。详细配置见 [运行配置](templates/template-api/docs/runtime.md)。
