# 数据库迁移边界

本目录是 API 模板的独立迁移链，使用迁移日志表 `drizzle.__drizzle_migrations_generic_api`。`generic-api-baseline` 创建管理端和通用配置表；后续 `client-accounts` 迁移新增客户端账号、平台身份和 UID 计数器表。基于原通用模板迁移链的数据库可在确认目标与备份后执行新增迁移，新应用在独立的新数据库上按顺序执行整条链。

原小程序应用的历史迁移 SQL 和快照可在 Git 提交 `eac7d0a` 的 `examples/miniapp-api/migrations` 中查阅，对应原迁移日志表 `drizzle.__drizzle_migrations`。它与本目录的迁移链不能混用：不要对旧业务库执行本模板的 `push` 或初始迁移，也不要覆盖既有迁移历史。旧业务库需要单独评估数据和迁移方案。

旧迁移中的 `unified-miniapp-auth` 曾删除旧 `client_users`，因此从含有旧业务数据的最早结构升级并非无损；涉及既有数据时需要单独制定保留方案。

本次代码调整不自动迁移数据库、不删除历史业务数据。新模板不再支持支付宝登录，旧数据库中已有的平台身份不会被自动删除；涉及既有数据时须单独评估处理方式。
