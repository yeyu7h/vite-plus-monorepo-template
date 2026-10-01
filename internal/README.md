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

`@monorepo/build-config` 直接导出 TypeScript 源码，供当前 Vite+ 配置加载器使用，无须先构建配置包。它只依赖工具，不依赖消费它的业务包。

- `defineLibraryConfig`：公共 ESM、声明生成和 `.mjs` / `.d.ts` 后缀。
- `defineNodeLibraryConfig`：在普通库基础上设置 `platform: 'node'`。
- `defineVueLibraryConfig`：增加 Vue 插件、Vue 声明生成、`src/index.ts` 入口、`unbundle` 和 `neutral` 平台。

```ts
import { defineNodeLibraryConfig } from '@monorepo/build-config'

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

类型包的 `exports: false` 配置、API 应用配置和仓库根 lint / fmt / test 配置保持独立。新增预设应来自实际重复，并保留各消费方的入口、平台和测试行为。

## Admin 应用配置

`@monorepo/vite-config` 提供 `defineAdminConfig`，按原有顺序组合运行时配置注入、加载页、Vue Router、Vue、JSX、布局、Tailwind 和 Nuxt UI 插件。它与库构建配置分包，避免应用预设依赖插件、插件又依赖库构建预设时形成循环。

普通前台应用可使用同包的 `defineWebConfig`，只组合 Vue Router、Vue、Tailwind 和 Nuxt UI，并由应用传入 `root`、`nuxtUI` 和 `vite` 覆盖配置。它不注入管理端专用的运行时配置和布局插件。

```ts
import { defineAdminConfig } from '@monorepo/vite-config'

export default defineAdminConfig({
  root: new URL('.', import.meta.url),
  loading: { themeStorageKey: 'vueuse-color-scheme' },
  nuxtUI: {
    ui: { colors: { neutral: 'neutral' } },
    scanPackages: ['@monorepo-admin-core/common-ui'],
  },
  vite: {
    server: { proxy: { '/api': 'http://localhost:9999' } },
  },
})
```

- `root` 必填，使用绝对路径或文件 URL。Vite 根目录、`.env` 读取、加载页模板、包元数据及 `@` / `#` 别名都基于该目录。
- `nuxtUI` 直接透传 Nuxt UI 插件选项；主题和扫描包由应用声明。
- `layouts` 可覆盖默认的 `src/layouts` 和 `Basic` 布局。
- `loading` 可传入 `loadingTemplate` 和 `themeStorageKey`；环境、构建模式和根目录由工厂统一注入。
- `vite` 支持静态配置或异步回调，回调接收 `{ command, mode, root, env, ... }`。`env` 使用 Vite 默认的 `VITE_` 前缀过滤，不自动开放其他环境变量。
- 应用配置通过 Vite+ 的 `mergeConfig` 合并：普通嵌套对象合并，插件列表和多数数组追加；别名等字段遵循 Vite 的专用合并规则。应用的 `plugins` 会追加在预设插件后。`root` 和 `envDir` 不在覆盖接口中，统一使用顶层 `root`。

目录与依赖方向为：`templates/template-admin` → `internal/vite-config` → 配置注入/加载页插件 → `internal/build-config`。配置包直接导出 TypeScript 源码，无须预构建。应用若直接使用某个插件的客户端类型，仍需保留该插件的直接依赖，例如 `vite-plugin-vue-layouts-next/client` 和加载页的 `@monorepo/vite-plugin-app-loading/runtime`。

## 验证

在仓库根目录运行 `vp check`、`vp test`、`vp run -r test` 和 `vp run -r build`。修改共享 TypeScript 配置时还应核对消费方解析后的编译选项和文件范围，避免继承改变路径含义。
