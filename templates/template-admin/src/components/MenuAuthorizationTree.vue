<script setup lang="ts">
import { ref } from 'vue'

export type MenuAuthorizationTreeItem = {
  id: string
  title: string
  type?: string
  accessScope?: 'public' | 'restricted'
  checked?: boolean
  inherited?: boolean
  direct?: boolean
  readOnly?: boolean
  children?: MenuAuthorizationTreeItem[]
}

defineOptions({ name: 'MenuAuthorizationTree' })

const props = withDefaults(
  defineProps<{
    items: MenuAuthorizationTreeItem[]
    selectedIds?: string[]
    level?: number
  }>(),
  { selectedIds: () => [], level: 0 },
)

const emit = defineEmits<{ toggle: [id: string, checked: boolean] }>()
const expanded = ref(new Set(props.items.filter((item) => item.children?.length).map(({ id }) => id)))

function toggleExpanded(id: string) {
  const next = new Set(expanded.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expanded.value = next
}

function forwardToggle(id: string, checked: boolean) {
  emit('toggle', id, checked)
}
</script>

<template>
  <ul class="space-y-1" :aria-label="level === 0 ? '菜单授权树' : undefined">
    <li v-for="item in items" :key="item.id">
      <div class="flex min-h-9 items-center gap-2 rounded-md px-2 hover:bg-elevated" :style="{ paddingInlineStart: `${level * 20 + 8}px` }">
        <UButton
          v-if="item.children?.length"
          :icon="expanded.has(item.id) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
          color="neutral"
          variant="ghost"
          size="xs"
          :aria-label="expanded.has(item.id) ? '收起' : '展开'"
          @click="toggleExpanded(item.id)"
        />
        <span v-else class="inline-block size-6" />
        <UCheckbox
          v-if="item.type !== 'group'"
          :model-value="selectedIds.includes(item.id)"
          :disabled="item.readOnly"
          :aria-label="item.title"
          @update:model-value="emit('toggle', item.id, Boolean($event))"
        />
        <span v-else class="inline-block size-4" />
        <UIcon
          :name="item.type === 'group' ? 'i-lucide-panels-top-left' : item.type === 'button' ? 'i-lucide-mouse-pointer-click' : item.type === 'directory' ? 'i-lucide-folder' : 'i-lucide-file'"
          class="size-4 text-muted"
        />
        <span class="min-w-0 flex-1 truncate text-sm text-default">{{ item.title }}</span>
        <UBadge v-if="item.type !== 'group' && item.accessScope === 'public'" label="公共" color="neutral" variant="subtle" size="sm" />
        <UBadge v-if="item.inherited" label="继承" color="info" variant="subtle" size="sm" />
        <UBadge v-else-if="item.direct" label="直接" color="primary" variant="subtle" size="sm" />
      </div>
      <MenuAuthorizationTree v-if="item.children?.length && expanded.has(item.id)" :items="item.children" :selected-ids="selectedIds" :level="level + 1" @toggle="forwardToggle" />
    </li>
  </ul>
</template>
