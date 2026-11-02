<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { buildRolePermissionGroups, hasRolePermission, mergeRolePermissions, removeRolePermissions } from './helpers'
import type { RolePermissionGroup, RolePermissionInput } from './helpers'

const props = defineProps<{
  catalog: RolePermissionInput[]
  inheritedPermissions: RolePermissionInput[]
  editable: boolean
  copyRoleOptions: Array<{ label: string; value: string }>
  copyingPermissions?: boolean
}>()
const emit = defineEmits<{ copy: [] }>()
const directPermissions = defineModel<RolePermissionInput[]>({ required: true })
const copyRoleId = defineModel<string>('copyRoleId', { default: '' })
const permissionSearch = ref('')
const collapsedPermissionGroups = ref(new Set<string>())

watch(
  () => props.catalog,
  (catalog) => {
    collapsedPermissionGroups.value = new Set(buildRolePermissionGroups(catalog).map(({ id }) => id))
  },
  { immediate: true },
)

const permissionGroups = computed(() => {
  const keyword = permissionSearch.value.trim().toLowerCase()
  return buildRolePermissionGroups(props.catalog)
    .map((group) => ({
      ...group,
      permissions:
        keyword && !`${group.label} ${group.id}`.toLowerCase().includes(keyword)
          ? group.permissions.filter(({ resource, action, summary }) => `${resource} ${action} ${summary ?? ''}`.toLowerCase().includes(keyword))
          : group.permissions,
    }))
    .filter(({ permissions: items }) => items.length > 0)
})
const isPermissionSearching = computed(() => Boolean(permissionSearch.value.trim()))
const permissionSearchResults = computed(() => permissionGroups.value.flatMap(({ permissions }) => permissions))
const customPermissions = computed(() => {
  const keyword = permissionSearch.value.trim().toLowerCase()
  return mergeRolePermissions(directPermissions.value, props.inheritedPermissions)
    .filter((permission) => !hasRolePermission(props.catalog, permission))
    .filter(({ resource, action }) => !keyword || `${resource} ${action}`.toLowerCase().includes(keyword))
})

function removeCustomPermission(permission: RolePermissionInput) {
  if (!props.editable) return
  directPermissions.value = removeRolePermissions(directPermissions.value, [permission])
}
function permissionSelection(permission: RolePermissionInput) {
  return hasRolePermission([...directPermissions.value, ...props.inheritedPermissions], permission)
}

function permissionGroupSelection(group: RolePermissionGroup): boolean | 'indeterminate' {
  const selected = group.permissions.filter(permissionSelection).length
  if (selected === 0) return false
  if (selected === group.permissions.length) return true
  return 'indeterminate'
}

function setPermissionGroupOpen(groupId: string, open: boolean) {
  const collapsed = new Set(collapsedPermissionGroups.value)
  if (open) collapsed.delete(groupId)
  else collapsed.add(groupId)
  collapsedPermissionGroups.value = collapsed
}

function toggleCatalogPermission(permission: RolePermissionInput, checked: boolean) {
  if (!props.editable || hasRolePermission(props.inheritedPermissions, permission)) return
  directPermissions.value = checked ? mergeRolePermissions(directPermissions.value, [permission]) : removeRolePermissions(directPermissions.value, [permission])
}

function togglePermissionGroup(group: RolePermissionGroup, checked: boolean) {
  if (!props.editable) return
  directPermissions.value = checked ? mergeRolePermissions(directPermissions.value, group.permissions, props.inheritedPermissions) : removeRolePermissions(directPermissions.value, group.permissions)
}

function selectAllCatalogPermissions() {
  if (!props.editable) return
  directPermissions.value = mergeRolePermissions(directPermissions.value, props.catalog, props.inheritedPermissions)
}

function clearDirectPermissions() {
  if (!props.editable) return
  directPermissions.value = []
}
</script>

<template>
  <div class="space-y-4">
    <div v-if="editable" class="mb-4 space-y-3 rounded-lg border border-default p-3">
      <div class="text-sm font-medium text-default">快捷授权</div>
      <div class="flex flex-wrap items-center gap-2">
        <USelectMenu v-model="copyRoleId" :items="copyRoleOptions" value-key="value" placeholder="选择一个角色作为模板" class="min-w-56 flex-1" />
        <UButton label="复制权限" icon="i-lucide-copy" color="neutral" variant="outline" :disabled="!copyRoleId" :loading="copyingPermissions" @click="emit('copy')" />
        <UButton label="全选接口目录" icon="i-lucide-list-checks" color="neutral" variant="outline" @click="selectAllCatalogPermissions" />
        <UButton label="清空直接权限" icon="i-lucide-eraser" color="neutral" variant="ghost" @click="clearDirectPermissions" />
      </div>
    </div>

    <div class="space-y-3">
      <UInput v-model="permissionSearch" icon="i-lucide-search" placeholder="搜索资源路径或 HTTP 方法" class="w-full" />
      <div v-if="isPermissionSearching && permissionSearchResults.length > 0" class="overflow-hidden rounded-lg border border-default">
        <div class="divide-y divide-default">
          <div v-for="permission in permissionSearchResults" :key="`${permission.resource}:${permission.action}`" class="flex items-center gap-3 px-3 py-2.5">
            <UCheckbox
              :model-value="permissionSelection(permission)"
              :disabled="!editable || hasRolePermission(inheritedPermissions, permission)"
              :aria-label="`${permission.action} ${permission.resource}`"
              @update:model-value="toggleCatalogPermission(permission, Boolean($event))"
            />
            <UBadge :label="permission.action" color="neutral" variant="subtle" class="w-14 shrink-0 justify-center p-1 text-xs" />
            <div class="min-w-0 flex-1">
              <code class="block truncate text-xs text-default">{{ permission.resource }}</code>
              <p v-if="permission.summary" :title="permission.summary" class="truncate text-[11px] leading-4 text-muted">{{ permission.summary }}</p>
            </div>
            <UBadge v-if="hasRolePermission(inheritedPermissions, permission)" label="继承" color="info" variant="subtle" class="shrink-0" />
          </div>
        </div>
      </div>
      <template v-else>
        <div v-for="group in permissionGroups" :key="group.id" class="relative">
          <div class="absolute top-0 left-3 z-10 flex h-11 items-center">
            <UCheckbox
              :model-value="permissionGroupSelection(group)"
              :disabled="!editable"
              :aria-label="`选择${group.label}全部接口`"
              @update:model-value="togglePermissionGroup(group, Boolean($event))"
            />
          </div>
          <UCollapsible :open="!collapsedPermissionGroups.has(group.id)" class="overflow-hidden rounded-lg border border-default" @update:open="setPermissionGroupOpen(group.id, $event)">
            <template #default="{ open }">
              <button type="button" class="flex h-11 w-full min-w-0 items-center gap-2 bg-elevated pr-3 pl-10 text-left">
                <span class="shrink-0 text-sm font-medium text-default">{{ group.label }}</span>
                <code class="min-w-0 truncate text-xs text-muted">{{ group.id }}</code>
                <UBadge :label="`${group.permissions.filter(permissionSelection).length}/${group.permissions.length}`" color="neutral" variant="subtle" class="ml-auto shrink-0" />
                <UIcon name="i-lucide-chevron-right" class="size-4 shrink-0 text-muted transition-transform duration-200" :class="open ? 'rotate-90' : 'rotate-0'" />
              </button>
            </template>
            <template #content>
              <div class="divide-y divide-default">
                <div v-for="permission in group.permissions" :key="`${permission.resource}:${permission.action}`" class="flex items-center gap-3 px-3 py-2.5">
                  <UCheckbox
                    :model-value="permissionSelection(permission)"
                    :disabled="!editable || hasRolePermission(inheritedPermissions, permission)"
                    :aria-label="`${permission.action} ${permission.resource}`"
                    @update:model-value="toggleCatalogPermission(permission, Boolean($event))"
                  />
                  <UBadge :label="permission.action" color="neutral" variant="subtle" class="w-14 shrink-0 justify-center p-1 text-xs" />
                  <div class="min-w-0 flex-1">
                    <code class="block truncate text-xs text-default">{{ permission.resource }}</code>
                    <p v-if="permission.summary" :title="permission.summary" class="truncate text-[11px] leading-4 text-muted">{{ permission.summary }}</p>
                  </div>
                  <UBadge v-if="hasRolePermission(inheritedPermissions, permission)" label="继承" color="info" variant="subtle" class="shrink-0" />
                </div>
              </div>
            </template>
          </UCollapsible>
        </div>
      </template>
      <section v-if="customPermissions.length" aria-label="自定义权限规则" class="overflow-hidden rounded-lg border border-default">
        <div class="space-y-1 bg-elevated px-3 py-2.5">
          <h3 class="text-sm font-medium text-default">自定义权限规则</h3>
          <p class="text-xs text-muted">这些已有规则未列在当前接口目录中，保存时会保留；移除后保存才会撤销直接授权。</p>
        </div>
        <div class="divide-y divide-default">
          <div v-for="permission in customPermissions" :key="JSON.stringify([permission.resource, permission.action])" class="flex flex-wrap items-center gap-2 px-3 py-2.5">
            <code class="break-all text-xs text-default">{{ permission.action }}</code>
            <code class="min-w-0 flex-1 break-all text-xs text-default">{{ permission.resource }}</code>
            <UBadge v-if="hasRolePermission(inheritedPermissions, permission)" label="继承" color="info" variant="subtle" />
            <UButton
              v-if="editable && hasRolePermission(directPermissions, permission)"
              label="移除"
              :aria-label="`移除 ${permission.action} ${permission.resource}`"
              color="error"
              variant="ghost"
              size="xs"
              @click="removeCustomPermission(permission)"
            />
          </div>
        </div>
      </section>
      <UEmpty v-if="permissionGroups.length === 0 && customPermissions.length === 0" icon="i-lucide-search-x" title="没有匹配的接口或规则" />
    </div>
  </div>
</template>
