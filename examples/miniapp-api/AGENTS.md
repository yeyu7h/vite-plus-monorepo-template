# Miniapp API Example Agent Guide

## Commands

所有命令从仓库根目录执行：

```bash
vp run @example/miniapp-api#dev
vp run @example/miniapp-api#build
vp run @example/miniapp-api#test
vp run @example/miniapp-api#test:integration
vp run @example/miniapp-api#generate
vp run @example/miniapp-api#migrate
vp run @example/miniapp-api#push
vp run @example/miniapp-api#seed
```

提交前运行 `vp check`、`vp run -r test` 和 `vp run -r build`。默认测试不得依赖 PostgreSQL 或 Redis；外部服务测试使用 `*.integration.test.ts`。

## Architecture

- 这是具体业务示例，不是默认 API 模板；保留账号隔离、平台验证和客户端会话。
- 历史迁移及快照必须保持原样，不能用通用模板的初始迁移替换。

- `/api/*`：公共接口；`/api/client/*`：客户端 JWT；`/api/admin/*`：管理端 JWT + RBAC + 审计。
- 路由和中间件由 app 自己通过 `import.meta.glob` 提供给 `@monorepo/server-core`。
- 数据库、日志、Redis、BullMQ、Casbin 和业务 Schema 属于本 app。
- 跨 app 的 Hono/OpenAPI 生命周期能力放在 `@monorepo/server-core`。
- 通用 Refine 查询能力放在 `@monorepo/server-refine-query`，必须显式注入数据库与日志器。
- 服务端 Vite 插件放在 `@monorepo/server-vite-plugin`，优雅关闭目标必须显式配置模块和导出名。

## Conventions

- 响应使用 `Resp` 与 `HttpStatusCodes`。
- 日志数据对象在前，消息在后；除环境校验、singleton、测试和脚本外不使用 `console`。
- Schema 变更后，开发环境用 `push`，需要迁移文件时用 `generate`。
- 优先从 Zod Schema 推导类型；避免显式 `any`，底层框架类型桥接只允许窄范围 lint 说明。
- 数据库时间戳使用 `date-fns` 按部署时区格式化，不用 `toISOString()` 写入本地时间字段。
- CRUD、Schema、tier、Drizzle v1、BullMQ 和 Effect 变更遵循仓库 `.agents/skills` 中对应技能。
