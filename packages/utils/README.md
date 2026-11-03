# @monorepo/utils

跨 app 复用的工具。公共入口 `@monorepo/utils` 包含 `tryit`、对象/字符串处理、IP 工具和类型守卫，可用于浏览器和服务端。

Zod 环境校验依赖 Node.js，通过独立入口 `@monorepo/utils/node` 导入，仅供服务端使用：

```ts
import { isRecord } from '@monorepo/utils'
import { parseEnvOrExit, safeParseEnv } from '@monorepo/utils/node'
```

开发时通过 workspace 源码导出，发布前使用 `vp pack` 生成 `dist` 与声明文件。

```bash
vp run @monorepo/utils#test
vp run @monorepo/utils#build
```
