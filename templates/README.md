# 应用模板

本目录保存 `admin`、`web`、`api` 三种应用模板的源码。它们也是工作区项目，可以直接通过各自的 `@app/template-*` 包名运行和验证。

从仓库根目录执行 `vp run create:app -- <admin|web|api> <app-name>`，会复制对应模板到 `apps/<app-name>`。创建出的应用拥有自己的包名和源码；后续模板改动不会同步到已有应用。需要新增模板类型时，同时更新 `scripts/create-app.mjs` 的类型列表和根目录文档。
