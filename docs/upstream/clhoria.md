# Clhoria Template 上游追踪

## 当前基线

- 上游仓库：[zhe-qi/clhoria-template](https://github.com/zhe-qi/clhoria-template)
- 上游本机快照：`/Users/zzz/Desktop/clhoria-template-main`
- 对比日期：2026-07-27
- 上游提交：`c38862618fa5d306e1795b0b4ee8a48a9d63ea74`（上游 `HEAD`；根据本机快照为最新版本的确认记录）

本机快照不含 `.git`，因此无法自行追溯 commit SHA；后续同步应从此提交开始比较，并在完成后更新本文件的基线 SHA。

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
