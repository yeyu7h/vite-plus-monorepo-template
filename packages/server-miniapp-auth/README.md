# @monorepo/server-miniapp-auth

服务端微信、支付宝小程序身份验证适配器。不同业务复用代码，各自管理账号、数据库、UID、权限和业务会话。

```ts
import { createMiniappAuth, miniappAppsSchema } from '@monorepo/server-miniapp-auth'

const apps = miniappAppsSchema.parse({
  'wechat-main': { provider: 'wechat', appId: process.env.WECHAT_APP_ID, appSecret: process.env.WECHAT_APP_SECRET },
  'alipay-main': {
    provider: 'alipay',
    appId: process.env.ALIPAY_APP_ID,
    privateKey: process.env.ALIPAY_PRIVATE_KEY,
    alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY,
    keyType: 'PKCS8',
    subjectType: 'open_id',
  },
})
const auth = createMiniappAuth({ apps })
const identity = await auth.verify('wechat-main', code)
// { provider, appId, subjectType, subject, unionId? }
// 由具体业务根据这个可信身份查找或注册账号，再签发业务 Token。
```

- 客户端仅提交配置中的应用标识和临时凭证，应用凭据由服务端配置。
- 身份唯一键为 `(provider, appId, subjectType, subject)`。不根据相同昵称或 UnionID 自动合并。
- 微信调用 `code2Session`；支付宝通过官方 `alipay-sdk` 调用 `alipay.system.oauth.token`，显式启用 RSA2 响应验签。
- 支付宝默认为 `open_id`。旧应用确实使用 `user_id` 时显式配置 `subjectType: 'user_id'`；已分配账号后切换标识类型需要身份迁移。
- 支付宝支持普通公钥和证书内容模式。证书模式提供 `appCertContent`、`alipayPublicCertContent`、`alipayRootCertContent`。沙箱配置 `sandbox: true`。
- 默认平台请求超时 8 秒。不会重试一次性 code，也不返回 SDK 原始异常、平台 Token、`session_key` 或密钥。
- 稳定错误码：`APP_NOT_CONFIGURED`、`INVALID_CODE`、`PROVIDER_UNAVAILABLE`、`INVALID_PROVIDER_RESPONSE`。

本包只处理平台身份验证，不导出业务 UID、账号注册、头像昵称或会话策略。完整业务示例见 [`examples/miniapp-api`](../../examples/miniapp-api/README.md)，其中 UID 规则由业务自身管理。

应用配置 Schema 输出类型为 `MiniappApps`；接收原始配置时先调用 `miniappAppsSchema.parse`，以应用默认值并校验凭据。

官方协议：[微信小程序登录](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/login.html)、[支付宝小程序授权](https://opendocs.alipay.com/mini/api/openapi-authorize)、[支付宝官方 Node SDK](https://github.com/alipay/alipay-sdk-nodejs-all)。
