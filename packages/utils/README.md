# @monorepo/utils

跨 app 复用且与服务端运行时无关的工具，包含 `tryit`、对象/字符串处理、IP 工具和 Zod 环境校验。

开发时通过 workspace 源码导出，发布前使用 `vp pack` 生成 `dist` 与声明文件。

```bash
vp run @monorepo/utils#test
vp run @monorepo/utils#build
```

部分代码源自 Clhoria Template，许可见仓库根目录 `THIRD_PARTY_NOTICES.md`。
