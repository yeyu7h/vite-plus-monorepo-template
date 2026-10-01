# @app/template-admin

Vue 3 管理端模板，使用 Vite+、文件路由、布局、Nuxt UI、Pinia、Vue Query 和仓库的管理端共享 packages。

## 本地启动

从仓库根目录执行：

```bash
vp install
vp run @app/template-admin#dev
```

开发环境的 `/api` 请求代理到 `http://localhost:9999`。如需使用后端接口，另起终端执行 `vp run dev:api`。

## 结构

- `src/pages`：文件路由；页面可用 `definePage` 提供标题、图标和权限元信息。
- `src/layouts`：管理端布局与简洁布局。
- `src/router`：文件路由、动态授权路由与导航守卫。
- `src/stores`：登录、用户、权限及应用状态。
- `src/api`：请求客户端和 API 调用。
- `src/composables`、`src/components`：管理表单、表格和页面交互。

构建：`vp run @app/template-admin#build`。OpenAPI 类型生成命令见 `package.json`；运行前需要启动 API。
