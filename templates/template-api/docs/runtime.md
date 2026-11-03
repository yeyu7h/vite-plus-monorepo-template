# 运行配置与健康检查

## 最小配置

从 `.env.example` 复制环境文件，填写数据库、Redis 地址与独立的管理端 JWT 密钥：

```dotenv
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/app
REDIS_URL=redis://localhost:6379/0
ADMIN_JWT_SECRET=填写至少32字符的随机密钥
STORAGE_PROVIDER=none
```

可用 `openssl rand -base64 32` 生成 JWT 密钥。环境文件只在本地保存；从模板创建应用不会复制真实环境文件。生产服务与集成测试使用各自独立的地址和凭据。

启动时校验连接地址与配置：PostgreSQL 接受 `postgres:`、`postgresql:`，Redis 接受 `redis:`、`rediss:`；`PORT` 必须是 1–65535 的整数，连接池大小必须为正整数。错误配置会阻止启动，校验过程不主动探测网络。`SENTRY_DSN` 留空即关闭错误上报。

对象存储是可选能力。`STORAGE_PROVIDER=none` 不需要存储凭据；启用 `r2` 或 `rustfs` 后才要求完整配置。省略该变量仍沿用旧版 R2 行为，详见 [对象存储](object-storage.md)。

## 存活与就绪

| 接口                    | 用途              | 返回                                                   |
| ----------------------- | ----------------- | ------------------------------------------------------ |
| `GET /api/health`       | HTTP 进程存活检查 | `200`，`data.status` 为 `ok`                           |
| `GET /api/health/ready` | 必要依赖就绪检查  | PostgreSQL 与 Redis 均正常时 `200`；失败或超时为 `503` |

两项接口均支持 `HEAD`，返回 `Cache-Control: no-store`，并豁免依赖 Redis 的全局限流。豁免只匹配这两个路径的 GET、HEAD，请求其他接口仍按原有限流与认证规则执行。若修改 `app.config.ts` 的 `/api` 前缀，同时更新探测路径、限流豁免以及容器健康检查。

就绪检查并行执行 PostgreSQL `SELECT 1` 和 Redis `PING`，每项最多等待 2 秒。同一依赖上未结束的探测会被后续请求复用，避免超时后的轮询不断积累查询。探测只读，不执行迁移、seed 或创建存储桶。返回成功表示连接可用，不代表业务数据库迁移已经完成。

成功响应示例：

```json
{
  "data": {
    "status": "ready",
    "checks": { "database": "ok", "redis": "ok" },
    "timestamp": "2026-11-03 10:00:00"
  }
}
```

失败响应的 HTTP 状态为 `503`，包含 `message: "服务尚未就绪"`，`data.status` 为 `not_ready`，对应依赖标记为 `error`。公开响应不包含连接地址、凭据或底层异常信息。

Dockerfile 和 Compose 的 API 健康检查使用就绪接口；部署平台的进程存活探针使用 `/api/health`，接收流量的就绪探针使用 `/api/health/ready`。对象存储属于可选业务依赖，本检查不探测它；实际读写可通过专用 `test:storage` 验证。
