<script setup lang="ts" generic="T extends TableData">
import type { TableColumn, TableData, TableSlots } from '@nuxt/ui'

defineOptions({ inheritAttrs: false })
withDefaults(
  defineProps<{
    data: T[]
    columns: TableColumn<T>[]
    loading?: boolean
    /** Omit total for an unpaginated table. */
    total?: number
    pageSize?: number
    emptyTitle?: string
    emptyIcon?: string
  }>(),
  { pageSize: 10, emptyTitle: '暂无数据', emptyIcon: 'i-lucide-inbox' },
)

const page = defineModel<number>('page', { default: 1 })
const slots = defineSlots<TableSlots<T>>()
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <UTable :data="data" :columns="columns" :loading="loading" sticky="header" class="min-h-0 flex-1" v-bind="$attrs">
      <template v-for="name in Object.keys(slots).filter((name) => name !== 'empty')" :key="name" #[name]="scope">
        <slot :name="name" v-bind="scope" />
      </template>
      <template #empty>
        <slot name="empty"><UEmpty :icon="emptyIcon" :title="emptyTitle" /></slot>
      </template>
    </UTable>
    <div v-if="total !== undefined" class="flex justify-end border-t border-default px-4 py-3">
      <UPagination v-model:page="page" :total="total" :items-per-page="pageSize" />
    </div>
  </div>
</template>
