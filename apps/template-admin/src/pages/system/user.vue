<script setup lang="ts">
import type { AdminMenuItem } from '@monorepo-admin-core/types'
import type { FormSubmitEvent, TableColumn } from '@nuxt/ui'
import { useToast } from '@nuxt/ui/runtime/composables/useToast.js'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { z } from 'zod'

import type { SystemRoleApi, SystemUserApi } from '@/api/core/system'
import { systemRoleApi, systemUserApi } from '@/api/core/system'
import { useConfirm } from '@/composables/useConfirm'
import { ALL_STATUS_VALUE, buildServerListQuery, buildSystemUserUpdateBody, getApiErrorMessage } from '@/features/system-management/helpers'
import { useAdminAccessStore } from '@/stores/access'
import { useAdminUserStore } from '@/stores/user'

definePage({ meta: { title: '用户管理', icon: 'i-lucide-users-round', order: 30, authority: ['admin'] } })

const accessStore = useAdminAccessStore()
const confirm = useConfirm()
const userStore = useAdminUserStore()
const toast = useToast()
const loading = ref(false)
const saving = ref(false)
const users = ref<SystemUserApi.Item[]>([])
const roles = ref<SystemRoleApi.Item[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 10
const search = ref('')
const status = ref(ALL_STATUS_VALUE)

const slideoverOpen = ref(false)
const editingUser = ref<SystemUserApi.Item | null>(null)
const form = reactive({
  username: '',
  nickName: '',
  password: '',
  avatar: '',
  homePath: null as string | null,
  status: 'ENABLED' as 'ENABLED' | 'DISABLED',
  roleIds: [] as string[],
})

const createSchema = z.object({
  username: z.string().min(4, '用户名最少 4 个字符').max(32).regex(/^\w+$/, '只能包含字母、数字和下划线'),
  nickName: z.string().min(1, '请输入昵称').max(32),
  password: z.string().min(6, '初始密码最少 6 个字符').max(20),
  homePath: z.string().startsWith('/', '默认首页路径必须以 / 开头').max(255).nullable(),
})
const updateSchema = createSchema.omit({ password: true })

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

async function loadUsers() {
  const requestSessionVersion = accessStore.sessionVersion
  loading.value = true
  try {
    const result = await systemUserApi.list(buildServerListQuery({ page: page.value, pageSize, search: search.value, searchFields: ['username', 'nickName'], status: status.value }))
    users.value = result.items
    total.value = result.total
  } catch (error) {
    if (accessStore.isLoggedIn && accessStore.sessionVersion === requestSessionVersion) {
      toast.add({ title: '加载用户失败', description: getApiErrorMessage(error), color: 'error' })
    }
  } finally {
    loading.value = false
  }
}

async function loadRoles() {
  const requestSessionVersion = accessStore.sessionVersion
  try {
    roles.value = (await systemRoleApi.list({ mode: 'off', sorters: JSON.stringify([{ field: 'name', order: 'asc' }]) })).items
  } catch (error) {
    if (accessStore.isLoggedIn && accessStore.sessionVersion === requestSessionVersion) {
      toast.add({ title: '加载角色选项失败', description: getApiErrorMessage(error), color: 'error' })
    }
  }
}

function searchUsers() {
  page.value = 1
  void loadUsers()
}

function openEditor(user?: SystemUserApi.Item) {
  editingUser.value = user ?? null
  Object.assign(form, {
    username: user?.username ?? '',
    nickName: user?.nickName ?? '',
    password: '',
    avatar: user?.avatar ?? '',
    homePath: user?.homePath ?? null,
    status: user?.status ?? 'ENABLED',
    roleIds: user?.roles.map(({ id }) => id) ?? [],
  })
  slideoverOpen.value = true
}

async function saveUser(event: FormSubmitEvent<z.output<typeof createSchema> | z.output<typeof updateSchema>>) {
  saving.value = true
  try {
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
    await loadUsers()
  } catch (error) {
    toast.add({ title: '保存用户失败', description: getApiErrorMessage(error), color: 'error' })
  } finally {
    saving.value = false
  }
}

async function requestDelete(user: SystemUserApi.Item) {
  await confirm({
    title: '删除用户',
    description: `将永久删除用户“${user.nickName}（${user.username}）”及其角色关联。此操作不可撤销。`,
    confirmLabel: '确认删除',
    errorTitle: '删除用户失败',
    formatError: getApiErrorMessage,
    onConfirm: async () => {
      await systemUserApi.delete(user.id)
      toast.add({ title: '用户已删除', color: 'success' })
      await loadUsers()
    },
  })
}

watch(status, searchUsers)
watch(page, loadUsers)
onMounted(() => Promise.all([loadUsers(), loadRoles()]))
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
      <UButton icon="i-lucide-refresh-cw" aria-label="刷新" color="neutral" variant="ghost" :loading="loading" @click="loadUsers" />
    </div>

    <UTable :data="users" :columns="columns" :loading="loading" sticky="header" class="min-h-0 flex-1">
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
    </UTable>

    <div class="flex justify-end border-t border-default px-4 py-3"><UPagination v-model:page="page" :total="total" :items-per-page="pageSize" /></div>
  </div>

  <USlideover v-model:open="slideoverOpen" :title="editingUser ? `编辑用户 · ${editingUser.nickName}` : '新建用户'" description="内置用户不能禁用、改用户名或修改角色。">
    <template #body>
      <UForm id="user-form" :schema="editingUser ? updateSchema : createSchema" :state="form" class="space-y-4" @submit="saveUser">
        <UFormField name="username" label="用户名" required><UInput v-model="form.username" :disabled="Boolean(editingUser?.builtIn)" class="w-full" autocomplete="off" /></UFormField>
        <UFormField name="nickName" label="昵称" required><UInput v-model="form.nickName" class="w-full" /></UFormField>
        <UFormField v-if="!editingUser" name="password" label="初始密码" required description="6–20 个字符。"
          ><UInput v-model="form.password" type="password" class="w-full" autocomplete="new-password"
        /></UFormField>
        <UFormField name="avatar" label="头像地址"><UInput v-model="form.avatar" class="w-full" /></UFormField>
        <UFormField name="homePath" label="默认首页" description="登录后优先打开；不可访问时自动进入第一个可访问菜单。"
          ><USelectMenu v-model="form.homePath" value-key="value" :items="homePathOptions" placeholder="跟随系统默认" clear class="w-full"
        /></UFormField>
        <UFormField name="status" label="状态"
          ><USelect
            v-model="form.status"
            :disabled="Boolean(editingUser?.builtIn)"
            :items="[
              { label: '启用', value: 'ENABLED' },
              { label: '禁用', value: 'DISABLED' },
            ]"
            class="w-full"
        /></UFormField>
        <UFormField name="roleIds" label="角色" description="禁用角色不会出现在可选列表中。"
          ><USelectMenu v-model="form.roleIds" multiple value-key="value" :disabled="Boolean(editingUser?.builtIn)" :items="assignableRoleOptions" class="w-full"
        /></UFormField>
      </UForm>
    </template>
    <template #footer="{ close }"><UButton label="取消" color="neutral" variant="outline" @click="close" /><UButton type="submit" form="user-form" label="保存" :loading="saving" /></template>
  </USlideover>
</template>
