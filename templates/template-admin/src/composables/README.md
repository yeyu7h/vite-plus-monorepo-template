# 表格与表单

用户、角色、参数页使用以下组合，组件和 hook 可以独立使用。

| 模块             | 职责                                                                         |
| ---------------- | ---------------------------------------------------------------------------- |
| `useServerTable` | 服务端分页、提交搜索、即时筛选、刷新、缓存失效、按查询前缀隔离占位数据       |
| `AdminTable`     | `UTable` 与分页布局，保留带行类型的单元格插槽；其他属性和事件透传给 `UTable` |
| `useAdminForm`   | 表单校验、提交、值读写与重置；字段和 Zod schema 成组更新                     |
| `AdminForm`      | 按字段配置渲染 Nuxt UI 表单，支持条件字段及自定义控件插槽                    |
| `useFormEditor`  | 编辑记录、表单回填、新建默认值、回填标记、用于重置验证状态的 `formKey`       |
| `FormSlideover`  | 抽屉、唯一表单 ID、保存/取消按钮及保存中状态；支持自定义 footer              |

## 列表查询

```ts
const status = ref<string | null>(null)
const { page, pageSize, search, items, total, loading, applySearch, refresh, invalidate } = useServerTable({
  queryKey: () => ['admin', accessStore.sessionVersion, 'params'],
  enabled: () => accessStore.isLoggedIn,
  filterSources: [status],
  buildQuery: (state) => buildServerListQuery({ ...state, searchFields: ['key', 'name'], status: status.value ?? undefined }),
  queryFn: systemParamApi.list,
})
```

`search` 是输入值，调用 `applySearch()` 后生效；重复查询会重新请求。`filterSources` 变化时立即应用当前搜索并回到第一页。改变 `pageSize` 也会回到第一页。

`queryFn` 返回 `{ items, total }`，`buildQuery` 负责适配接口协议。`queryKey` 必须包含资源和会话/租户等数据范围；同一范围翻页时保留旧行，范围改变时清除占位数据。保存或删除成功后调用 `invalidate()`，其他关联资源的缓存由页面按需处理。

```vue
<AdminTable v-model:page="page" :data="items" :columns="columns" :loading="loading" :total="total" :page-size="pageSize">
  <template #name-cell="{ row }">{{ row.original.name }}</template>
</AdminTable>
```

不传 `total` 时不显示分页。默认空状态可用 `emptyTitle`、`emptyIcon` 或 `#empty` 插槽覆盖；`#loading`、列插槽和原生表格事件也可继续使用。树结构、权限按钮和业务筛选控件仍由页面组织。

## 编辑表单

字段配置适合常规管理表单，复杂控件可以通过字段名插槽接入。`useAdminForm` 只处理表单；编辑记录和抽屉由 `useFormEditor`、`FormSlideover` 组合。用户管理页展示了完整用法：

```ts
const editor = useFormEditor({ toForm: (item?: Item) => ({ name: item?.name ?? '', password: '' }) })
const createFields = [{ name: 'name' as const }, { name: 'password' as const }]
const editFields = [{ name: 'name' as const }]
const config = computed(() => (editor.editing.value ? { schema: updateSchema, fields: editFields } : { schema: createSchema, fields: createFields }))

const { formRef, formProps, validate, submitForm, setValues, getValues, resetForm } = useAdminForm({
  state: editor.form,
  initialValues: () => ({ name: editor.editing.value?.name ?? '', password: '' }),
  replaceValues: editor.hydrate,
  config,
})
```

```vue
<AdminForm :key="editor.formKey.value" ref="formRef" v-bind="formProps" @submit="save" />
```

`validate()` 返回由 Zod schema 推导的输出类型或 `false`，`submitForm()` 触发表单原生的校验和 `@submit`。字段与 schema 使用同一份响应式 `config`；运行时可用 `setConfig()` 成组覆盖、`resetConfig()` 恢复原配置。隐藏或移除字段时，应在同一份配置里同步调整 schema。`getValues()` 返回表单状态的副本，`resetForm()` 回到 `initialValues()`。表单须挂载后才能调用校验和提交。

参数页也使用了这套组合：普通字段留在 `config.fields`，提示放在 `#leading`，根据值类型切换的输入控件放在 `#value`。跨字段的值校验仍由原有 Zod `superRefine` 负责，值类型切换和 JSON 操作仍由页面处理。复杂字段只配置一个 `component: 'slot'`，避免把业务行为塞进通用组件。

对于需要大量自定义布局的表单，也可只使用较小的编辑状态 hook：

```ts
const { open, editing, form, formKey, openEditor } = useFormEditor({
  toForm: (item?: SystemRoleApi.Item) => ({
    id: item?.id ?? '',
    name: item?.name ?? '',
    parentRoleIds: [...(item?.parentRoles ?? [])],
  }),
})
```

`toForm()` 返回新建默认值，`toForm(item)` 返回编辑值；数组和嵌套对象应创建副本，避免修改查询缓存。调用 `openEditor()` 新建，调用 `openEditor(item)` 编辑。关闭时保留状态供抽屉离场动画使用，再次打开时重新回填。

```vue
<FormSlideover v-model:open="open" :title="editing ? '编辑角色' : '新建角色'" :saving="saving">
  <template #body="{ formId }">
    <UForm :id="formId" :key="formKey" :schema="schema" :state="form" :disabled="saving" @submit="save">
      <UFormField name="name" label="名称" required><UInput v-model="form.name" /></UFormField>
    </UForm>
  </template>
</FormSlideover>
```

将 `formKey` 绑定到 `UForm` 的 `key`，每次打开都清除上一次的验证状态。`FormSlideover` 通过 `formId` 将底部按钮关联到原生表单；自定义 `#footer` 时同样可以取得 `formId` 和 `close`。角色页展示了多 Tab、多种保存操作的用法。

字段、Zod schema、请求体转换和 `useMutation` 留在业务页；字段联动若需要区分回填与用户操作，可参照参数页在同步 watcher 中检查 `hydrating.value`。

当前抽象先放在应用内。多个管理端出现相同使用方式后，再迁移到 `@admin-core`，避免共享包依赖具体业务接口或 store。
