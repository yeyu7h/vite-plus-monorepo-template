# 微信、支付宝小程序登录

首版包含平台登录、首次自动注册、业务 UID、当前用户信息、刷新与退出。不提供手机号绑定、身份绑定或账号合并；App 手机号登录作为后续客户端能力接入。业务用户只能使用客户端，后台必须使用独立的管理账号。

## 账号与 UID

- `client_users` 保存微信、支付宝及未来 App 共用的业务账号，不包含后台用户名、密码、内置账号标记或后台首页等字段。
- `system_users` 独立保存后台管理账号。`system_user_roles` 仅能关联此表，不能为业务用户授予后台角色。后台用户管理接口也仅操作管理账号。
- `client_user_identities` 保存验证后的业务平台身份，只能关联 `client_users`，不保存 OAuth Token 或 `session_key`。
- 用户内部主键保持 UUIDv7。订单等业务关系使用内部主键；对外 UID 独立存储为字符串。
- `client_user_uid_counters` 按一位数字前缀原子递增，默认前缀 `1`，不区分微信、支付宝，也不表示管理权限。
- UID 序号初始补齐八位：`100000001`、`199999999`、`1100000000`。增长只发生在序号部分。已有 UID 不变，删除用户不重置计数器。
- UID 只属于业务用户，业务注册不创建后台账号或角色。管理账号没有业务 UID；两类账号即使碰巧拥有相同 UUID，也分别查询各自的表、校验各自的登录凭证与账号状态。
- 两个平台首次登录且未建立关联时是两个账号。此版本不会自动推断或合并它们。

同一平台身份的首次登录通过事务锁串行处理。用户、身份和 UID 在同一事务中提交，数据库另有平台身份及 UID 唯一约束。

## 环境配置

`MINIAPP_APPS` 是只供服务端使用的 JSON 应用注册表。默认 `{}`，不启用任何平台；请求未配置应用会返回 `APP_NOT_CONFIGURED`。同一业务可配置多个 AppID。

```dotenv
MINIAPP_APPS='{"wechat-main":{"provider":"wechat","appId":"wx-your-app-id","appSecret":"your-app-secret"},"alipay-main":{"provider":"alipay","appId":"your-app-id","privateKey":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----","alipayPublicKey":"-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----","keyType":"PKCS8","subjectType":"open_id"}}'
USER_UID_PREFIX=1
CLIENT_ACCESS_TOKEN_SECONDS=900
CLIENT_SESSION_SECONDS=604800
```

支付宝证书模式以 `appCertContent`、`alipayPublicCertContent`、`alipayRootCertContent` 替代普通公钥，内容均为 PEM 字符串。沙箱额外指定 `sandbox: true`。旧应用返回 `user_id` 时须显式指定 `subjectType: "user_id"`；默认不做标识类型降级，避免身份混淆。

为每个部署配置独立的强随机 `CLIENT_JWT_SECRET`、`ADMIN_JWT_SECRET`。开发、沙箱和正式应用使用各自配置。真实小程序联调需要平台中已配置相应应用、密钥及可访问的 HTTPS API 域名。

## API

所有接口位于 `/api/client/auth`，成功响应使用 `{ "data": ... }`，错误响应使用 `{ "message": "...", "code": "..." }`。Token 与用户信息响应设置 `Cache-Control: no-store`。

| 方法 | 路径        | 请求               | 认证               |
| ---- | ----------- | ------------------ | ------------------ |
| POST | `/login`    | `{ appKey, code }` | 平台临时凭证       |
| POST | `/refresh`  | `{ refreshToken }` | 业务刷新令牌       |
| GET  | `/userinfo` | 无                 | Bearer accessToken |
| POST | `/logout`   | 无                 | Bearer accessToken |

登录返回：

```json
{
  "data": {
    "user": { "id": "UUIDv7", "uid": "100000001", "nickname": "用户100000001", "avatar": null, "createdAt": "2026-11-02 12:00:00" },
    "isNewUser": true,
    "accessToken": "业务 JWT",
    "refreshToken": "业务刷新令牌",
    "expiresIn": 900,
    "refreshExpiresIn": 604800
  }
}
```

`createdAt` 可为空。`/userinfo` 仅返回上述 `user`。`/refresh` 返回新的 Token 对及剩余有效秒数；不需要有效 Access Token。旧的刷新令牌立即失效，客户端须串行刷新、原子替换保存的 Token 对。

默认会话绝对有效期为七天，刷新不会无限延长会话。Access Token 过期且刷新令牌仍有效时可刷新；会话过期后重新调用平台登录。平台凭证失败时重新向平台获取 code，禁止重用或自动重试同一个 code。

允许多设备同时在线。退出撤销当前会话，使该会话的 Access Token 和 Refresh Token 同时失效；其他设备不受影响。每个受保护请求会检查服务端会话及业务账号状态。客户端 Token 带固定 `aud: client`、`iss: miniapp-client`；后台 Token 带 `aud: admin`、`iss: admin-auth`。两端使用不同密钥、账号表和会话存储，Token 不可互换，业务用户也不能通过后台角色分配接口变成管理账号。旧版不含后台 audience／issuer 的管理端 Token 需要重新登录。

刷新令牌只在 Redis 中保存哈希。轮换通过 Lua 原子完成，关联键位于同一 Redis Cluster 槽。认证存储或平台异常会拒绝认证并返回可重试的服务不可用状态；不会因基础设施异常放行。

## 小程序调用示例

微信原生：

```js
wx.login({
  success(result) {
    if (!result.code) return
    wx.request({
      url: API_BASE + '/api/client/auth/login',
      method: 'POST',
      data: { appKey: 'wechat-main', code: result.code },
      success(response) {
        if (response.statusCode !== 200) return
        wx.setStorageSync('authTokens', response.data.data)
      },
    })
  },
})
```

支付宝原生：

```js
my.getAuthCode({
  scopes: ['auth_base'],
  success(result) {
    if (!result.authCode) return
    my.request({
      url: API_BASE + '/api/client/auth/login',
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      data: JSON.stringify({ appKey: 'alipay-main', code: result.authCode }),
      success(response) {
        if (response.status !== 200) return
        my.setStorageSync({ key: 'authTokens', data: response.data.data })
      },
    })
  },
})
```

业务请求携带 `Authorization: Bearer <accessToken>`。小程序仅接收业务 Token，不接收 AppSecret、应用私钥、微信会话密钥或支付宝 OAuth Token。

## 数据库与验证

迁移历史中的 `unified-miniapp-auth` 曾引入统一 `users`，保留为历史记录。后续 `isolate-client-accounts` 迁移将管理账号和业务用户重新拆分；已有业务 UUID、UID、平台身份及 UID 计数器均保留，纯业务记录不会留在管理账号表。此迁移不提供账号合并或业务账号提升为管理员的能力。应用迁移前核对目标库；不要修改已执行的历史迁移。

```bash
vp run @app/template-api#migrate
vp run @app/template-api#seed
vp run @monorepo/server-miniapp-auth#test
vp run @app/template-api#test
```

集成测试需要独立 PostgreSQL 18+（UUIDv7）与 Redis，并先执行迁移、seed。必须通过 `TEST_DATABASE_URL`、`TEST_REDIS_URL` 显式指定专用测试服务，再运行 `vp run @app/template-api#test:integration`；缺少任一地址会在加载测试前终止。集成测试任务禁用缓存，始终检查真实外部状态。平台适配器在集成测试中替换为已验证身份，PostgreSQL 与 Redis 使用真实服务；真实平台联调另需有效应用配置及客户端一次性凭证。
