# @monorepo/server-refine-query

Drizzle PostgreSQL 的 Refine 查询 schemas、过滤/排序转换、分页和执行器。

```ts
const { executeRefineQuery } = createRefineQuery({ db, logger, pagination })
```

包内不依赖具体 app 的数据库、日志器或常量。部分代码源自 Clhoria Template，许可见仓库根目录 `THIRD_PARTY_NOTICES.md`。
