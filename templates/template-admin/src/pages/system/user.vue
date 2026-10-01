<script setup lang="ts">
import type { AdminMenuItem } from '@monorepo-admin-core/types'
import type { FormSubmitEvent, TableColumn } from '@nuxt/ui'
import { useToast } from '@nuxt/ui/runtime/composables/useToast.js'
import { computed, ref } from 'vue'
import type { DeepReadonly } from 'vue'
import { useMutation, useQuery } from '@tanstack/vue-query'
import { z } from 'zod'

import type { SystemUserApi } from '@/api/core/system'
import { systemRoleApi, systemUserApi } from '@/api/core/system'
import { useConfirm } from '@/composables/useConfirm'
import AdminForm from '@/components/AdminForm.vue'
import type { AdminFormField } from '@/components/admin-form'
import AdminTable from '@/components/AdminTable.vue'
import FormSlideover from '@/components/FormSlideover.vue'
import { useServerTable } from '@/composables/useServerTable'
import { useAdminForm } from '@/composables/useAdminForm'
import { useFormEditor } from '@/composables/useFormEditor'
import { ALL_STATUS_VALUE, buildServerListQuery, buildSystemUserUpdateBody } from '@/features/system-management/helpers'
import { useAdminAccessStore } from '@/stores/access'
import { useAdminUserStore } from '@/stores/user'

definePage({ meta: { title: '用户管理', icon: 'i-lucide-users-round', order: 30, authority: ['admin'] } })

const accessStore = useAdminAccessStore()
const confirm = useConfirm()
const userStore = useAdminUserStore()
const toast = useToast()
const status = ref(ALL_STATUS_VALUE)

const createSchema = z.object({
  username: z.string().min(4, '用户名最少 4 个字符').max(32).regex(/^\w+$/, '只能包含字母、数字和下划线'),
  nickName: z.string().min(1, '请输入昵称').max(32),
  password: z.string().min(6, '初始密码最少 6 个字符').max(20),
  homePath: z.string().startsWith('/', '默认首页路径必须以 / 开头').max(255).nullable(),
})
const updateSchema = createSchema.omit({ password: true })

function toUserForm(user?: DeepReadonly<SystemUserApi.Item>) {
  return {
    username: user?.username ?? '',
    nickName: user?.nickName ?? '',
    password: '',
    avatar: user?.avatar ?? '',
    homePath: user?.homePath ?? null,
    status: user?.status ?? 'ENABLED',
    roleIds: user?.roles.map(({ id }) => id) ?? [],
  }
}

type UserForm = ReturnType<typeof toUserForm>

const { open: slideoverOpen, editing: editingUser, form, formKey, hydrate: editorHydrate, openEditor } = useFormEditor({ toForm: toUserForm })

const createFields: AdminFormField<UserForm, DeepReadonly<SystemUserApi.Item>>[] = [
  { name: 'username', label: '用户名', required: true, componentProps: { autocomplete: 'off' }, disabled: (_state, user) => Boolean(user?.builtIn) },
  { name: 'nickName', label: '昵称', required: true },
  { name: 'password', label: '初始密码', required: true, description: '6–20 个字符。', componentProps: { type: 'password', autocomplete: 'new-password' } },
  { name: 'avatar', label: '头像地址' },
  { name: 'homePath', label: '默认首页', description: '登录后优先打开；不可访问时自动进入第一个可访问菜单。', component: 'slot' },
  {
    name: 'status',
    label: '状态',
    component: 'select',
    componentProps: {
      items: [
        { label: '启用', value: 'ENABLED' },
        { label: '禁用', value: 'DISABLED' },
      ],
    },
    disabled: (_state, user) => Boolean(user?.builtIn),
  },
  { name: 'roleIds', label: '角色', description: '禁用角色不会出现在可选列表中。', component: 'slot' },
]
const updateFields = createFields.filter((field) => field.name !== 'password')
const formConfig = computed(() => (editingUser.value ? { schema: updateSchema, fields: updateFields } : { schema: createSchema, fields: createFields }))

const { formRef, formProps } = useAdminForm({
  state: form,
  initialValues: () => toUserForm(editingUser.value ?? undefined),
  config: formConfig,
  item: editingUser,
  replaceValues: editorHydrate,
})

const columns: TableColumn<SystemUserApi.Item>[] = [
  { accessorKey: 'username', header: '用户' },
  { accessorKey: 'roles', header: '角色' },
  { accessorKey: 'status', header: '状态' },
  { accessorKey: 'createdAt', header: '创建时间' },
  { id: 'actions', header: '操作' },
]

const assignableRoleOptions = computed(() => roles.value.filter(({ status: roleStatus }) => roleStatus === 'ENABLED').map((role) => ({ label: `${role.name} (${role.id})`, value: role.id })))
const homePathOptions = computed(() => {
  const options: Array<{ label: string; value: string }> = []
  const paths = new Set<string>()

  const appendItems = (items: readonly AdminMenuItem[], ancestors: readonly string[]) => {
    for (const item of items) {
      const labels = [...ancestors, item.title]
      if (item.children?.length) {
        appendItems(item.children, labels)
      } else if (!item.externalLink && item.path && !paths.has(item.path)) {
        paths.add(item.path)
        options.push({ label: labels.join(' / '), value: item.path })
      }
    }
  }

  for (const group of accessStore.menuGroups) appendItems(group.children, group.label ? [group.label] : [])
  if (form.homePath && !paths.has(form.homePath)) options.push({ label: `当前值（不可用）· ${form.homePath}`, value: form.homePath })

  return options
})

const {
  page,
  pageSize,
  search,
  items: users,
  total,
  loading,
  applySearch: searchUsers,
  refresh: loadUsers,
  invalidate: invalidateList,
} = useServerTable({
  queryKey: () => ['admin', accessStore.sessionVersion, 'users'],
  enabled: () => accessStore.isLoggedIn,
  filterSources: [status],
  buildQuery: (state) => buildServerListQuery({ ...state, searchFields: ['username', 'nickName'], status: status.value }),
  queryFn: systemUserApi.list,
})

const { data: roleOptionsData } = useQuery({
  queryKey: computed(() => ['admin', accessStore.sessionVersion, 'role-options'] as const),
  enabled: computed(() => accessStore.isLoggedIn),
  retry: false,
  refetchOnWindowFocus: false,
  queryFn: () => systemRoleApi.list({ mode: 'off', sorters: JSON.stringify([{ field: 'name', order: 'asc' }]) }),
})
const roles = computed(() => roleOptionsData.value?.items ?? [])

const { isPending: saving, mutate: saveUser } = useMutation({
  mutationFn: async (event: FormSubmitEvent<z.output<typeof createSchema> | z.output<typeof updateSchema>>) => {
    const common = {
      username: event.data.username,
      nickName: event.data.nickName,
      avatar: form.avatar || null,
      homePath: event.data.homePath,
      status: form.status,
      roleIds: form.roleIds,
    }
    if (editingUser.value) await systemUserApi.update(editingUser.value.id, buildSystemUserUpdateBody(common, editingUser.value.builtIn === true))
    else await systemUserApi.create({ ...common, password: form.password })
    slideoverOpen.value = false
    toast.add({ title: editingUser.value ? '用户已更新' : '用户已创建', color: 'success' })
    await invalidateList()
  },
})

async function requestDelete(user: SystemUserApi.Item) {
  await confirm({
    title: '删除用户',
    description: `将永久删除用户“${user.nickName}（${user.username}）”及其角色关联。此操作不可撤销。`,
    confirmLabel: '确认删除',
    onConfirm: async () => {
      await systemUserApi.delete(user.id)
      toast.add({ title: '用户已删除', color: 'success' })
      await invalidateList()
    },
  })
}
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="flex flex-wrap items-center justify-between gap-3 border-b border-default px-4 py-3">
      <div>
        <h1 class="text-lg font-semibold text-highlighted">用户管理</h1>
        <p class="text-sm text-muted">真实系统用户与角色分配；密码仅在创建时设置，本阶段不提供密码重置。</p>
      </div>
      <UButton v-if="accessStore.hasPermission('system:user:create')" icon="i-lucide-user-plus" label="新建用户" @click="openEditor()" />
    </div>

    <div class="flex flex-wrap items-center gap-2 border-b border-default px-4 py-3">
      <UInput v-model="search" icon="i-lucide-search" placeholder="搜索用户名或昵称" class="w-64" @keyup.enter="searchUsers" />
      <USelect
        v-model="status"
        :items="[
          { label: '全部状态', value: ALL_STATUS_VALUE },
          { label: '启用', value: 'ENABLED' },
          { label: '禁用', value: 'DISABLED' },
        ]"
        class="w-36"
      />
      <UButton label="查询" color="neutral" variant="outline" @click="searchUsers" />
      <UButton icon="i-lucide-refresh-cw" aria-label="刷新" color="neutral" variant="ghost" :loading="loading" @click="loadUsers()" />
    </div>

    <AdminTable v-model:page="page" :data="users" :columns="columns" :loading="loading" :total="total" :page-size="pageSize">
      <template #username-cell="{ row }">
        <div class="flex items-center gap-3">
          <UAvatar :src="row.original.avatar ?? undefined" :alt="row.original.nickName" size="sm" />
          <div>
            <div class="flex items-center gap-2 font-medium text-default">
              {{ row.original.nickName }}<UBadge v-if="row.original.builtIn" label="内置" color="warning" variant="subtle" size="sm" />
            </div>
            <div class="text-xs text-muted">{{ row.original.username }}</div>
          </div>
        </div>
      </template>
      <template #roles-cell="{ row }"
        ><div class="flex max-w-80 flex-wrap gap-1">
          <UBadge v-for="role in row.original.roles" :key="role.id" :label="role.name" color="info" variant="subtle" /><span v-if="!row.original.roles.length" class="text-muted">未分配角色</span>
        </div></template
      >
      <template #status-cell="{ row }"
        ><UBadge :label="row.original.status === 'ENABLED' ? '启用' : '禁用'" :color="row.original.status === 'ENABLED' ? 'success' : 'neutral'" variant="subtle"
      /></template>
      <template #createdAt-cell="{ row }"
        ><span class="text-sm text-muted">{{ row.original.createdAt || '—' }}</span></template
      >
      <template #actions-cell="{ row }">
        <div class="flex justify-end gap-1">
          <UButton v-if="accessStore.hasPermission('system:user:update')" icon="i-lucide-pencil" label="编辑" color="neutral" variant="ghost" @click="openEditor(row.original)" />
          <UButton
            v-if="!row.original.builtIn && row.original.id !== userStore.userInfo?.user_id && accessStore.hasPermission('system:user:delete')"
            icon="i-lucide-trash-2"
            aria-label="删除用户"
            color="error"
            variant="ghost"
            @click="requestDelete(row.original)"
          />
        </div>
      </template>
      <template #empty><UEmpty icon="i-lucide-users" title="暂无用户" /></template>
    </AdminTable>
  </div>

  <FormSlideover v-model:open="slideoverOpen" :saving="saving" :title="editingUser ? `编辑用户 · ${editingUser.nickName}` : '新建用户'" description="内置用户不能禁用、改用户名或修改角色。">
    <template #body="{ formId }">
      <AdminForm :id="formId" :key="formKey" ref="formRef" v-bind="formProps" :disabled="saving" class="space-y-4" @submit="saveUser">
        <template #homePath>
          <USelectMenu v-model="form.homePath" value-key="value" :items="homePathOptions" placeholder="跟随系统默认" clear class="w-full" />
        </template>
        <template #roleIds>
          <USelectMenu v-model="form.roleIds" multiple value-key="value" :disabled="Boolean(editingUser?.builtIn)" :items="assignableRoleOptions" class="w-full" />
        </template>
      </AdminForm>
    </template>
  </FormSlideover>
</template>
