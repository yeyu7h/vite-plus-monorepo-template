<script setup lang="ts">
import Badge from '@nuxt/ui/components/Badge.vue'
import Button from '@nuxt/ui/components/Button.vue'
import Checkbox from '@nuxt/ui/components/Checkbox.vue'
import { useToast } from '@nuxt/ui/runtime/composables/useToast.js'
import { computed, onMounted, ref, watch } from 'vue'

import { getRoleMenuPermissionsApi, getSystemRolesApi, type RoleMenuPermission, type SystemRoleOption, saveRoleMenuPermissionsApi } from '@/api/roles'
import { useAdminAccessStore } from '@/stores/access'

definePage({
  meta: {
    title: '角色管理',
    icon: 'i-lucide-shield-check',
    menuGroup: { label: '系统管理', order: 20 },
    order: 20,
    authority: ['admin'],
    contentMode: 'full',
  },
})

type FlatPermission = RoleMenuPermission & { depth: number; parentId?: string }

const toast = useToast()
const accessStore = useAdminAccessStore()
const roles = ref<SystemRoleOption[]>([])
const selectedRoleId = ref('')
const permissions = ref<FlatPermission[]>([])
const loadingRoles = ref(false)
const loadingPermissions = ref(false)
const saving = ref(false)

const selectedRole = computed(() => roles.value.find((role) => role.id === selectedRoleId.value))
const isAdminRole = computed(() => selectedRoleId.value === 'admin')

function flattenMenus(items: RoleMenuPermission[], depth = 0, parentId?: string): FlatPermission[] {
  return items.flatMap((item) => [{ ...item, depth, parentId }, ...flattenMenus(item.children, depth + 1, item.id)])
}

async function loadRoles() {
  loadingRoles.value = true
  try {
    roles.value = await getSystemRolesApi()
    if (!roles.value.some((role) => role.id === selectedRoleId.value)) selectedRoleId.value = roles.value[0]?.id ?? ''
  } catch (error) {
    toast.add({ title: '加载角色失败', description: errorMessage(error), color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    loadingRoles.value = false
  }
}

async function loadPermissions(roleId: string) {
  if (!roleId) {
    permissions.value = []
    return
  }
  loadingPermissions.value = true
  try {
    const result = await getRoleMenuPermissionsApi(roleId)
    if (selectedRoleId.value === roleId) permissions.value = flattenMenus(result.menus)
  } catch (error) {
    toast.add({ title: '加载菜单权限失败', description: errorMessage(error), color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    if (selectedRoleId.value === roleId) loadingPermissions.value = false
  }
}

function setGranted(permission: FlatPermission, granted: boolean) {
  if (permission.disabled) return
  permission.granted = granted
  const byId = new Map(permissions.value.map((item) => [item.id, item]))
  if (granted) {
    let parentId = permission.parentId
    while (parentId) {
      const parent = byId.get(parentId)
      if (!parent) break
      parent.granted = true
      parentId = parent.parentId
    }
    return
  }
  const descendants = new Set<string>([permission.id])
  let changed = true
  while (changed) {
    changed = false
    for (const item of permissions.value) {
      if (item.parentId && descendants.has(item.parentId) && !descendants.has(item.id)) {
        descendants.add(item.id)
        changed = true
      }
    }
  }
  for (const item of permissions.value) {
    if (descendants.has(item.id) && !item.disabled) item.granted = false
  }
}

async function savePermissions() {
  if (!selectedRoleId.value || isAdminRole.value) return
  saving.value = true
  try {
    const menuIds = permissions.value.filter((permission) => permission.granted && !permission.inherited).map((permission) => permission.id)
    const result = await saveRoleMenuPermissionsApi(selectedRoleId.value, menuIds)
    permissions.value = flattenMenus(result.menus)
    toast.add({ title: '角色菜单权限已保存', description: '后端权限立即生效，前端菜单和按钮将在用户下次登录时更新。', color: 'success', icon: 'i-lucide-circle-check' })
  } catch (error) {
    toast.add({ title: '保存权限失败', description: errorMessage(error), color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    saving.value = false
  }
}

function typeLabel(type: FlatPermission['type']) {
  return { BUTTON: '按钮', DIRECTORY: '目录', EXTERNAL: '外链', IFRAME: 'iframe', PAGE: '页面' }[type]
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error && 'message' in error && typeof error.message === 'string') return error.message
  return '请求失败'
}

watch(selectedRoleId, (roleId) => loadPermissions(roleId))
onMounted(loadRoles)
</script>

<template>
  <div class="flex h-full min-h-0 flex-1 flex-col divide-y divide-default">
    <div class="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
      <div>
        <h1 class="text-lg font-semibold text-highlighted">角色权限</h1>
        <p class="text-sm text-muted">为角色选择可见菜单与可执行的按钮权限；勾选子项会自动保留祖先菜单。</p>
      </div>
      <Button
        v-if="accessStore.hasPermission('system:role:permission-update')"
        icon="i-lucide-save"
        label="保存权限"
        :disabled="!selectedRoleId || loadingPermissions || isAdminRole"
        :loading="saving"
        @click="savePermissions"
      />
    </div>

    <div class="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside class="border-b border-default p-3 lg:border-r lg:border-b-0">
        <div class="mb-2 px-2 text-xs font-semibold tracking-wide text-muted">角色</div>
        <div v-if="loadingRoles" class="px-2 py-6 text-sm text-muted">正在加载角色…</div>
        <div v-else class="space-y-1">
          <button
            v-for="role in roles"
            :key="role.id"
            type="button"
            class="flex w-full items-center justify-between rounded-md px-3 py-2 text-left transition-colors"
            :class="selectedRoleId === role.id ? 'bg-elevated text-highlighted' : 'text-default hover:bg-elevated/50'"
            @click="selectedRoleId = role.id"
          >
            <span>
              <span class="block text-sm font-medium">{{ role.name }}</span>
              <code class="text-xs text-muted">{{ role.id }}</code>
            </span>
            <Badge :color="role.status === 'ENABLED' ? 'success' : 'neutral'" :label="role.status === 'ENABLED' ? '启用' : '停用'" size="sm" variant="subtle" />
          </button>
        </div>
      </aside>

      <main class="min-h-0 overflow-auto p-4">
        <div v-if="loadingPermissions" class="py-12 text-center text-sm text-muted">正在加载菜单权限…</div>
        <div v-else-if="!selectedRole" class="py-12 text-center text-sm text-muted">请选择角色</div>
        <div v-else-if="permissions.length === 0" class="py-12 text-center text-sm text-muted">暂无菜单节点，请先在菜单管理中创建。</div>
        <div v-else class="mx-auto max-w-5xl overflow-hidden rounded-lg border border-default">
          <div v-if="isAdminRole" class="border-b border-default bg-elevated/50 px-4 py-3 text-sm text-muted">内置管理员固定拥有全部菜单与按钮权限。</div>
          <div class="divide-y divide-default">
            <div v-for="permission in permissions" :key="permission.id" class="flex items-start gap-3 px-4 py-3" :style="{ paddingLeft: `${16 + permission.depth * 24}px` }">
              <Checkbox
                :model-value="permission.granted"
                class="mt-0.5"
                :disabled="permission.disabled"
                :aria-label="`授权 ${permission.title}`"
                @update:model-value="setGranted(permission, Boolean($event))"
              />
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="text-sm font-medium text-default">{{ permission.title }}</span>
                  <Badge color="neutral" :label="typeLabel(permission.type)" size="sm" variant="subtle" />
                  <Badge v-if="permission.inherited" color="info" label="继承授权" size="sm" variant="subtle" />
                </div>
                <code v-if="permission.code" class="mt-1 block text-xs text-primary">{{ permission.code }}</code>
                <div v-else-if="permission.path" class="mt-1 text-xs text-muted">{{ permission.path }}</div>
                <div v-if="permission.resource" class="mt-1 flex flex-wrap gap-x-2 text-xs text-muted">
                  <span>{{ permission.action }}</span
                  ><span>{{ permission.resource }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>
