# 公共工程配置

`internal/*` 是仅供本仓库开发使用的 workspace 包。消费方在 `devDependencies` 中声明 `workspace:*` 依赖，安装使用 `vp install`。

## TypeScript

`@monorepo/tsconfig` 提供以下预设：

| 预设                | 使用场景                                              |
| ------------------- | ----------------------------------------------------- |
| `base.json`         | 最小公共检查选项；API 在本地补充 Hono 和 Bundler 配置 |
| `web.json`          | 浏览器 TypeScript，例如 request                       |
| `vue.json`          | Vue 应用和组件库，继承 web                            |
| `node.json`         | NodeNext 模块解析，例如 shared、utils                 |
| `node-bundler.json` | 经构建工具处理的 Node 库、Vite 插件                   |

```json
{
  "extends": "@monorepo/tsconfig/vue.json",
  "include": ["src"],
  "exclude": ["node_modules"]
}
```

`include`、`exclude`、`paths`、`typeRoots`、`references`、`outDir` 和 `tsBuildInfoFile` 留在消费方，保持路径相对于消费方配置文件解析。应用的全局类型、生成文件和 JSX 差异也由应用声明。Admin 的 `tsconfig.node.json` 保留独立的 composite 和输出设置。

## Vite+ 库构建

`@monorepo/vite-config` 直接导出 TypeScript 源码，供当前 Vite+ 配置加载器使用，无须先构建配置包。它只依赖工具，不依赖消费它的业务包。

- `defineLibraryConfig`：公共 ESM、声明生成和 `.mjs` / `.d.ts` 后缀。
- `defineNodeLibraryConfig`：在普通库基础上设置 `platform: 'node'`。
- `defineVueLibraryConfig`：增加 Vue 插件、Vue 声明生成、`src/index.ts` 入口、`unbundle` 和 `neutral` 平台。

```ts
import { defineNodeLibraryConfig } from '@monorepo/vite-config'

export default defineNodeLibraryConfig({
  pack: {
    entry: {
      index: 'src/index.ts',
      runtime: 'src/runtime.ts',
    },
  },
})
```

参数保留 Vite+ 配置形状。`pack` 按字段覆盖；数组及嵌套对象整体替换。例如覆盖 Vue 的 `dts` 时，应显式保留需要的 `vue: true` 和 `tsgo: false`；传入 `plugins` 或 `pack.plugins` 会替换对应默认插件列表。

类型包的 `exports: false` 配置、应用 Vite 配置和仓库根 lint / fmt / test 配置保持独立。新增预设应来自实际重复，并保留各消费方的入口、平台和测试行为。

## 验证

在仓库根目录运行 `vp check`、`vp test`、`vp run -r test` 和 `vp run -r build`。修改共享 TypeScript 配置时还应核对消费方解析后的编译选项和文件范围，避免继承改变路径含义。
