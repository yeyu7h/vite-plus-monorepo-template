# Clhoria Template 上游追踪

## 当前基线

- 上游仓库：[zhe-qi/clhoria-template](https://github.com/zhe-qi/clhoria-template)
- 上游本机快照：`/Users/zzz/Desktop/clhoria-template-main`
- 对比日期：2026-07-30
- 上游提交：`589f13ef6b294b3ed74646e3595ade644a6dcb47`（上游 `main`）

本机快照不含 `.git`，后续同步应以此处记录的 SHA 从上游远端比较，并在完成后更新本文件的基线 SHA。

## 最近同步记录

2026-07-30 从 `c38862618fa5d306e1795b0b4ee8a48a9d63ea74` 同步至当前基线：

- 同步 `sync-comments` 对 `snakeCase.table(...)` 的识别、缺失声明保护和单元测试。
- 同步 CRUD/数据库 Schema 技能中的 `snakeCase.table(...)` 示例。
- 同步 `createErrorSchema` 的 OpenAPI example metadata 测试，并兼容当前依赖的错误文案。
- 暂不同步上游依赖、包管理器和 lockfile 更新；这些内容需要通过 workspace catalog 单独升级和验证。
- 暂不同步 `tasks/` 忽略规则和 Stoker 索引注释；当前 monorepo 没有对应目录结构或功能需求。

## 目录映射

| Clhoria Template                                                              | 本仓库                                |
| ----------------------------------------------------------------------------- | ------------------------------------- |
| `src/routes/**`、`src/db/**`、`src/services/**`                               | `apps/template-api/src/**`            |
| `src/lib/core/{create-application,define-config,factory,singleton,stoker}/**` | `packages/server-core/src/**`         |
| `src/lib/core/refine-query/**`                                                | `packages/server-refine-query/src/**` |
| `plugins/**`                                                                  | `packages/server-vite-plugin/src/**`  |
| `src/utils/**`                                                                | `packages/utils/src/**`               |
| `Dockerfile`、`docker-compose.yml`、`vite.config.ts`、`package.json`          | 需要人工适配，不可直接覆盖            |

## 同步流程

1. 在上游 clone 中获取更新，并记录本次目标 commit。
2. 查看从本文件记录的基线到目标 commit 的文件变更。
3. 依照目录映射，在新分支逐项移植；不要直接 `git merge` 或复制整个上游目录。
4. 对 workspace 依赖、Vite+、Docker、环境变量和共享 package API 做人工适配。
5. 验证：

   ```bash
   vp check
   vp run -r test
   vp run -r build
   ```

6. 若涉及 PostgreSQL、Redis、迁移或 API 行为，再启动 Compose 并运行集成测试。

## 约束

- 不要用上游文件覆盖 `apps/template-api` 的 Docker/Compose/Vite+ 配置。
- 上游对 `src/lib/core`、`plugins`、`src/utils` 的修改需要同步到对应共享 package，而不是重新放回 app 内。
- 每次完成同步后，更新本文件的上游 SHA、同步日期和必要的兼容性说明。
