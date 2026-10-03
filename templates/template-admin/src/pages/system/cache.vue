<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { useToast } from '@nuxt/ui/runtime/composables/useToast.js'
import { computed, ref, watch } from 'vue'

import { systemCacheApi } from '@/api/core/system'
import type { CacheCategory, CacheItem } from '@/api/core/system'
import AdminTable from '@/components/AdminTable.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useAdminAccessStore } from '@/stores/access'

definePage({ meta: { title: '缓存管理', icon: 'i-lucide-database', order: 20, authority: ['admin'] } })

const accessStore = useAdminAccessStore()
const toast = useToast()
const confirm = useConfirm()
const category = ref<CacheCategory>('dict')
const search = ref('')
const rows = ref<CacheItem[]>([])
const cursor = ref('0')
const hasMore = ref(false)
const clearCursor = ref('0')
const loading = ref(false)
const clearing = ref(false)
let requestVersion = 0

const categories: { label: string; value: CacheCategory }[] = [
  { label: '字典缓存', value: 'dict' },
  { label: '参数缓存', value: 'param' },
  { label: 'IP 归属地缓存', value: 'ip' },
]
const categoryLabel = computed(() => categories.find((item) => item.value === category.value)?.label ?? '')
const visibleRows = computed(() => rows.value.filter((item) => item.key.toLowerCase().includes(search.value.trim().toLowerCase())))
const columns: TableColumn<CacheItem>[] = [
  { accessorKey: 'key', header: 'Redis 键' },
  { accessorKey: 'preview', header: '缓存内容预览' },
  { accessorKey: 'ttlSeconds', header: '剩余时间' },
  { id: 'actions', header: '操作' },
]

function ttlLabel(seconds: number) {
  if (seconds === -1) return '永不过期'
  if (seconds < 0) return '已过期'
  if (seconds < 60) return `${seconds} 秒`
  return `${Math.ceil(seconds / 60)} 分钟`
}

async function loadCache(reset = false) {
  if (!accessStore.isLoggedIn || loading.value) return
  const version = ++requestVersion
  const selectedCategory = category.value
  const nextCursor = reset ? '0' : cursor.value
  loading.value = true
  try {
    const result = await systemCacheApi.list(selectedCategory, nextCursor)
    if (version !== requestVersion || selectedCategory !== category.value) return
    rows.value = reset ? result.items : [...rows.value, ...result.items]
    cursor.value = result.cursor
    hasMore.value = result.hasMore
  } catch {
    toast.add({ title: '读取缓存失败', color: 'error' })
  } finally {
    if (version === requestVersion) loading.value = false
  }
}

watch(
  [category, () => accessStore.sessionVersion],
  () => {
    requestVersion++
    loading.value = false
    rows.value = []
    cursor.value = '0'
    hasMore.value = false
    clearCursor.value = '0'
    void loadCache(true)
  },
  { immediate: true },
)

async function requestRemove(item: CacheItem) {
  await confirm({
    title: '清除缓存键',
    description: `清除“${item.key}”后，下一次读取会重新生成该缓存。`,
    confirmLabel: '确认清除',
    onConfirm: async () => {
      await systemCacheApi.remove(item.key)
      toast.add({ title: '缓存已清除', color: 'success' })
      await loadCache(true)
    },
  })
}

async function requestClearCategory() {
  await confirm({
    title: `清除${categoryLabel.value}`,
    description: `将清除当前类别的业务缓存。每次最多扫描约 2000 个 Redis 键；若结果提示未完成，可继续执行。`,
    confirmLabel: '确认清除',
    onConfirm: async () => {
      clearing.value = true
      try {
        const result = await systemCacheApi.clearCategory(category.value, clearCursor.value)
        clearCursor.value = result.cursor
        toast.add({ title: `已清除 ${result.deleted} 条缓存`, description: result.complete ? undefined : '仍有未扫描的键，请继续清除。', color: result.complete ? 'success' : 'warning' })
        await loadCache(true)
      } finally {
        clearing.value = false
      }
    },
  })
}
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="flex flex-wrap items-center justify-between gap-3 border-b border-default px-4 py-3">
      <div>
        <h1 class="text-lg font-semibold text-highlighted">缓存管理</h1>
        <p class="text-sm text-muted">查看和清理字典、参数、IP 归属地缓存。</p>
      </div>
      <div class="flex gap-2">
        <UButton icon="i-lucide-refresh-cw" label="刷新" color="neutral" variant="outline" :loading="loading" @click="loadCache(true)" />
        <UButton
          icon="i-lucide-trash-2"
          :label="clearCursor === '0' ? '清除此类别' : '继续清除'"
          color="error"
          variant="outline"
          :loading="clearing"
          :disabled="loading"
          @click="requestClearCategory"
        />
      </div>
    </div>

    <div class="border-b border-default px-4 py-3">
      <UAlert title="仅管理业务缓存" description="登录态、刷新令牌、限流、验证码和任务队列数据不会显示，也不能从此页清除。缓存内容最多预览 4 KB。" color="info" variant="subtle" />
    </div>

    <div class="flex flex-wrap items-center gap-2 border-b border-default px-4 py-3">
      <USelect v-model="category" :items="categories" value-key="value" class="w-48" />
      <UInput v-model="search" icon="i-lucide-search" placeholder="筛选已加载的键" class="w-64" />
      <UButton label="重置" color="neutral" variant="outline" @click="search = ''" />
    </div>

    <AdminTable :data="visibleRows" :columns="columns" :loading="loading">
      <template #key-cell="{ row }">
        <code class="text-xs text-default">{{ row.original.key }}</code>
      </template>
      <template #preview-cell="{ row }">
        <code class="block max-w-80 truncate text-xs text-muted" :title="row.original.preview">{{ row.original.preview }}{{ row.original.truncated ? '…' : '' }}</code>
      </template>
      <template #ttlSeconds-cell="{ row }">
        <span class="text-sm text-muted">{{ ttlLabel(row.original.ttlSeconds) }}</span>
      </template>
      <template #actions-cell="{ row }">
        <div class="flex justify-end gap-1">
          <UButton icon="i-lucide-trash-2" aria-label="清除缓存" color="error" variant="ghost" @click="requestRemove(row.original)" />
        </div>
      </template>
      <template #loading />
      <template #empty>
        <UEmpty :title="hasMore ? '当前批次暂无匹配缓存，可继续加载' : '暂无缓存'" variant="naked" :ui="{ title: 'text-sm text-muted' }" class="absolute inset-x-0 bottom-0 top-12 rounded-none">
          <template #leading><UIcon name="i-lucide-database" class="size-12 text-muted" /></template>
        </UEmpty>
      </template>
    </AdminTable>

    <div v-if="hasMore" class="flex justify-center border-t border-default px-4 py-3">
      <UButton label="加载更多" color="neutral" variant="outline" :loading="loading" @click="loadCache()" />
    </div>
  </div>
</template>
