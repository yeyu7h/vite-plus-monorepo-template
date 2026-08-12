<script setup lang="ts">
import type { FormSubmitEvent, TableColumn } from '@nuxt/ui'
import { useToast } from '@nuxt/ui/runtime/composables/useToast.js'
import { computed, defineAsyncComponent, onMounted, reactive, ref, watch } from 'vue'
import { z } from 'zod'

import type { SystemParamApi } from '@/api/core/system'
import { systemParamApi } from '@/api/core/system'
import { useConfirm } from '@/composables/useConfirm'
import { buildServerListQuery, getApiErrorMessage } from '@/features/system-management/helpers'
import {
  formatParamValue,
  getDefaultParamValue,
  getParamStatusMetadata,
  getParamValueError,
  getParamValueTypeMetadata,
  paramStatusOptions,
  paramStatusValues,
  paramValueTypeOptions,
  paramValueTypeValues,
} from '@/features/system-management/param-metadata'
import type { ParamStatus, ParamValueType } from '@/features/system-management/param-metadata'
import { useAdminAccessStore } from '@/stores/access'

const ParamJsonEditor = defineAsyncComponent(() => import('@/features/system-management/ParamJsonEditor.vue'))

definePage({ meta: { title: '参数管理', icon: 'i-lucide-braces', order: 40, authority: ['admin'] } })

const accessStore = useAdminAccessStore()
const confirm = useConfirm()
const toast = useToast()
const loading = ref(true)
const saving = ref(false)
const params = ref<SystemParamApi.Item[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 10
const search = ref('')
const status = ref<ParamStatus | null>(null)

const slideoverOpen = ref(false)
const editingParam = ref<SystemParamApi.Item | null>(null)

type ParamForm = {
  key: string
  name: string
  value: string
  valueType: ParamValueType
  description: string
  status: ParamStatus
}

const form = reactive<ParamForm>({
  key: '',
  name: '',
  value: '',
  valueType: 'STRING',
  description: '',
  status: 'ENABLED',
})

let hydratingEditor = false

const paramSchema = z
  .object({
    key: z
      .string()
      .min(1, '请输入参数键')
      .max(128, '参数键最多 128 个字符')
      .regex(/^[a-z0-9_]+$/, '只能包含小写字母、数字和下划线'),
    name: z.string().min(1, '请输入参数名称').max(128, '参数名称最多 128 个字符'),
    value: z.string().min(1, '请输入参数值'),
    valueType: z.enum(paramValueTypeValues),
    description: z.string().max(1000, '描述最多 1000 个字符'),
    status: z.enum(paramStatusValues),
  })
  .superRefine((data, context) => {
    const message = getParamValueError(data.valueType, data.value)
    if (message) context.addIssue({ code: 'custom', path: ['value'], message })
  })

type ParamSchema = z.output<typeof paramSchema>

const columns: TableColumn<SystemParamApi.Item>[] = [
  { accessorKey: 'name', header: '参数' },
  { accessorKey: 'value', header: '当前值' },
  { accessorKey: 'valueType', header: '值类型' },
  { accessorKey: 'status', header: '状态' },
  { accessorKey: 'updatedAt', header: '更新时间' },
  { id: 'actions', header: '操作' },
]

const booleanOptions = [
  { label: 'true', value: 'true' },
  { label: 'false', value: 'false' },
]

const statusFilterOptions: { label: string; value: ParamStatus }[] = [
  { label: '已启用', value: 'ENABLED' },
  { label: '已禁用', value: 'DISABLED' },
]

const numberValue = computed<number | undefined>({
  get: () => {
    if (!form.value.trim()) return undefined
    const value = Number(form.value)
    return Number.isFinite(value) ? value : undefined
  },
  set: (value) => {
    form.value = value === undefined ? '' : String(value)
  },
})

async function loadParams() {
  const requestSessionVersion = accessStore.sessionVersion
  loading.value = true
  try {
    const result = await systemParamApi.list(
      buildServerListQuery({
        page: page.value,
        pageSize,
        search: search.value,
        searchFields: ['key', 'name'],
        status: status.value ?? undefined,
        sortField: 'updatedAt',
      }),
    )
    params.value = result.items
    total.value = result.total
  } catch (error) {
    if (accessStore.isLoggedIn && accessStore.sessionVersion === requestSessionVersion) {
      toast.add({ title: '加载参数失败', description: getApiErrorMessage(error), color: 'error' })
    }
  } finally {
    loading.value = false
  }
}

function searchParams() {
  if (page.value === 1) void loadParams()
  else page.value = 1
}

function resetFilters() {
  search.value = ''
  if (status.value !== null) status.value = null
  else searchParams()
}

function openEditor(param?: SystemParamApi.Item) {
  editingParam.value = param ?? null
  hydratingEditor = true
  Object.assign(form, {
    key: param?.key ?? '',
    name: param?.name ?? '',
    value: param ? formatParamValue(param.valueType, param.value) : '',
    valueType: param?.valueType ?? 'STRING',
    description: param?.description ?? '',
    status: param?.status ?? 'ENABLED',
  })
  hydratingEditor = false
  slideoverOpen.value = true
}

async function saveParam(event: FormSubmitEvent<ParamSchema>) {
  saving.value = true
  try {
    const payload = {
      key: event.data.key.trim(),
      name: event.data.name.trim(),
      value: formatParamValue(event.data.valueType, event.data.value),
      valueType: event.data.valueType,
      description: editingParam.value ? event.data.description.trim() : event.data.description.trim() || undefined,
      status: event.data.status,
    }

    if (editingParam.value) await systemParamApi.update(editingParam.value.id, payload)
    else await systemParamApi.create(payload)

    slideoverOpen.value = false
    toast.add({ title: editingParam.value ? '参数已更新' : '参数已创建', color: 'success' })
    await loadParams()
  } catch (error) {
    toast.add({ title: '保存参数失败', description: getApiErrorMessage(error), color: 'error' })
  } finally {
    saving.value = false
  }
}

function prettyPrintJson() {
  const message = getParamValueError('JSON', form.value)
  if (message) {
    toast.add({ title: 'JSON 格式错误', description: message, color: 'error' })
    return
  }
  form.value = formatParamValue('JSON', form.value)
}

async function copyJsonValue() {
  try {
    await navigator.clipboard.writeText(form.value)
    toast.add({ title: 'JSON 已复制', color: 'success', icon: 'i-lucide-check' })
  } catch {
    toast.add({ title: '复制失败', description: '请检查浏览器的剪贴板权限。', color: 'error' })
  }
}

async function requestDelete(param: SystemParamApi.Item) {
  await confirm({
    title: '删除参数',
    description: `将永久删除参数“${param.name}（${param.key}）”。此操作不可撤销。`,
    confirmLabel: '确认删除',
    errorTitle: '删除参数失败',
    formatError: getApiErrorMessage,
    onConfirm: async () => {
      await systemParamApi.delete(param.id)
      toast.add({ title: '参数已删除', color: 'success' })
      await loadParams()
    },
  })
}

watch(
  () => form.valueType,
  (valueType, previousValueType) => {
    if (hydratingEditor || valueType === previousValueType) return
    form.value = getDefaultParamValue(valueType)
  },
  { flush: 'sync' },
)
watch(status, searchParams)
watch(page, loadParams)
onMounted(loadParams)
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="flex flex-wrap items-center justify-between gap-3 border-b border-default px-4 py-3">
      <div>
        <h1 class="text-lg font-semibold text-highlighted">参数管理</h1>
        <p class="text-sm text-muted">维护可运行时调整的公开配置值；类型用于读取方正确解析字符串存储值。</p>
      </div>
      <UButton v-if="accessStore.hasPermission('system:param:create')" icon="i-lucide-plus" label="新建参数" @click="openEditor()" />
    </div>

    <div class="flex flex-wrap items-center gap-2 border-b border-default px-4 py-3">
      <UInput v-model="search" icon="i-lucide-search" placeholder="搜索参数键或名称" class="w-64" @keyup.enter="searchParams" />
      <USelectMenu v-model="status" :items="statusFilterOptions" value-key="value" placeholder="状态" :search-input="false" clear class="w-36" />
      <UButton label="重置" color="neutral" variant="outline" @click="resetFilters" />
    </div>

    <UTable :data="params" :columns="columns" :loading="loading" sticky="header" class="min-h-0 flex-1">
      <template #name-cell="{ row }">
        <div>
          <div class="font-medium text-default">{{ row.original.name }}</div>
          <code class="text-xs text-muted">{{ row.original.key }}</code>
        </div>
      </template>
      <template #value-cell="{ row }">
        <code class="block max-w-80 truncate text-xs text-muted" :title="row.original.value">{{ row.original.value }}</code>
      </template>
      <template #valueType-cell="{ row }">
        <UBadge :label="getParamValueTypeMetadata(row.original.valueType).label" :color="getParamValueTypeMetadata(row.original.valueType).color" variant="subtle" />
      </template>
      <template #status-cell="{ row }">
        <UBadge :label="getParamStatusMetadata(row.original.status).label" :color="getParamStatusMetadata(row.original.status).color" variant="subtle" />
      </template>
      <template #updatedAt-cell="{ row }">
        <span class="text-sm text-muted">{{ row.original.updatedAt || row.original.createdAt || '—' }}</span>
      </template>
      <template #actions-cell="{ row }">
        <div class="flex justify-end gap-1">
          <UButton v-if="accessStore.hasPermission('system:param:update')" icon="i-lucide-pencil" label="编辑" color="neutral" variant="ghost" @click="openEditor(row.original)" />
          <UButton v-if="accessStore.hasPermission('system:param:delete')" icon="i-lucide-trash-2" aria-label="删除参数" color="error" variant="ghost" @click="requestDelete(row.original)" />
        </div>
      </template>
      <template #loading />
      <template #empty>
        <UEmpty title="暂无数据" variant="naked" :ui="{ title: 'text-sm text-muted' }" class="absolute inset-x-0 bottom-0 top-12 rounded-none">
          <template #leading><UIcon name="i-lucide-inbox" class="size-12 text-muted" /></template>
        </UEmpty>
      </template>
    </UTable>

    <div class="flex justify-end border-t border-default px-4 py-3"><UPagination v-model:page="page" :total="total" :items-per-page="pageSize" /></div>
  </div>

  <USlideover v-model:open="slideoverOpen" :title="editingParam ? `编辑参数 · ${editingParam.name}` : '新建参数'" description="参数值以字符串保存，并由值类型约束其格式。">
    <template #body>
      <UForm id="param-form" :schema="paramSchema" :state="form" class="space-y-4" @submit="saveParam">
        <UAlert title="不要存放密码、令牌或私钥" description="启用的参数可通过公共参数接口读取；敏感值应使用环境变量或密钥管理服务。" color="warning" variant="subtle" />

        <UFormField name="key" label="参数键" required description="小写字母、数字和下划线，例如 site_name。">
          <UInput v-model="form.key" class="w-full" autocomplete="off" />
        </UFormField>
        <UFormField name="name" label="参数名称" required><UInput v-model="form.name" class="w-full" /></UFormField>
        <UFormField name="valueType" label="值类型" required :description="getParamValueTypeMetadata(form.valueType).description">
          <USelect v-model="form.valueType" :items="paramValueTypeOptions" class="w-full" />
        </UFormField>

        <UFormField name="value" label="参数值" required>
          <UTextarea v-if="form.valueType === 'STRING'" v-model="form.value" :rows="4" autoresize :maxrows="10" class="w-full" />
          <UInputNumber v-else-if="form.valueType === 'NUMBER'" v-model="numberValue" :increment="false" :decrement="false" :ui="{ base: 'text-left' }" class="w-full" />
          <URadioGroup v-else-if="form.valueType === 'BOOLEAN'" v-model="form.value" :items="booleanOptions" orientation="horizontal" />
          <ParamJsonEditor v-else v-model="form.value" :invalid="Boolean(getParamValueError('JSON', form.value))">
            <template #toolbar>
              <div class="flex items-center gap-1">
                <UButton type="button" label="格式化 JSON" icon="i-lucide-braces" color="neutral" variant="ghost" size="xs" @click="prettyPrintJson" />
                <UButton type="button" label="复制" icon="i-lucide-copy" color="neutral" variant="ghost" size="xs" :disabled="!form.value" @click="copyJsonValue" />
              </div>
            </template>
          </ParamJsonEditor>
        </UFormField>

        <UFormField name="description" label="描述"><UTextarea v-model="form.description" :rows="3" autoresize :maxrows="8" class="w-full" /></UFormField>
        <UFormField name="status" label="状态" :description="getParamStatusMetadata(form.status).description">
          <USelect v-model="form.status" :items="paramStatusOptions" class="w-full" />
        </UFormField>
      </UForm>
    </template>
    <template #footer="{ close }">
      <UButton label="取消" color="neutral" variant="soft" @click="close" />
      <UButton type="submit" form="param-form" label="保存" :loading="saving" />
    </template>
  </USlideover>
</template>
