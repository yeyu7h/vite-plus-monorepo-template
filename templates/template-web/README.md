# 普通 Web App 模板

独立于 `template-admin` 的 Vue 3 前台起点，使用 Vite+、Vue Router 文件路由、Nuxt UI、Tailwind 和仓库的 `@monorepo/request`。不包含后台菜单、角色权限和管理端布局。

## 启动

在仓库根目录运行：

```bash
vp install
vp run dev:web
```

访问 `http://localhost:5174`。首页及其余页面无需 API 即可使用。需要测试首页的“检查 API”按钮时，另起终端运行 `vp run dev:api`；开发代理把 `/api` 转发到 `http://localhost:9999`。

## 扩展

- `src/pages`：文件即路由。`index.vue` 对应 `/`，`about.vue` 对应 `/about`，`[...path].vue` 处理未匹配的路径。新增页面无需手动注册，开发时路由会热更新。
- `src/router/index.ts`：路由历史模式与滚动行为；可在这里增加前台专属的导航守卫。
- `src/components`：共享的前台组件与页面外壳。
- `src/api/client.ts`：公开 API 请求入口；用户端接口可在此基础上增加独立的认证拦截器。
- `src/styles/main.css`：主题和全局样式；Nuxt UI 配色在 `vite.config.ts` 设置。
- `.env.example`：API 地址示例。部署时可设置 `VITE_API_BASE_URL`，默认值是 `/api`。

这个模板是客户端渲染的单页应用。生产部署需要让服务器将非静态资源路径回退到 `index.html`。需要服务端渲染或 SEO 的站点可在此基础上另选合适框架。

构建：`vp run @app/template-web#build`。
