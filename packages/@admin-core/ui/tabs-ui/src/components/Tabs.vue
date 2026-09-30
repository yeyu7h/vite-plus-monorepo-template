<script setup lang="ts">
import type { AdminMenuImageIcon, AdminTabItem, AdminTabPlacement } from '@monorepo-admin-core/types'
import { cn } from '@monorepo/shared/utils'
import { ref } from 'vue'
import { useTabDrag } from './use-tab-drag'

const props = defineProps<{
  activeKey: string
  tabs: AdminTabItem[]
}>()

const emit = defineEmits<{
  close: [key: string]
  closeOthers: [key: string]
  closeRight: [key: string]
  openBrowserTab: [key: string]
  openIframeSource: [key: string]
  pin: [key: string, pinned: boolean]
  reorder: [key: string, targetKey: string, placement: AdminTabPlacement]
  refresh: [key: string]
  select: [key: string]
}>()

const contextMenuSnapshot = ref<{ key: string; pinned: boolean } | null>(null)
const { draggingKey, displayedTabs, startTabPointer, consumeDragClick } = useTabDrag({
  tabs: () => props.tabs,
  onReorder: (key, targetKey, placement) => emit('reorder', key, targetKey, placement),
})

/** 拖拽松手后阻止浏览器额外触发一次标签切换 */
function clickTab(event: MouseEvent, key: string) {
  if (consumeDragClick(event)) return
  selectTab(key)
}

/** 打开右键菜单时锁定固定状态，避免菜单关闭动画期间文案立即翻转
 * @param tab 当前标签页
 * @param open 菜单是否打开
 */
function captureContextMenuState(tab: AdminTabItem, open: boolean) {
  if (open) contextMenuSnapshot.value = { key: tab.key, pinned: isTabPinned(tab) }
}

/** 读取本次右键菜单打开时的固定状态
 * @param tab 当前标签页
 * @returns 菜单应展示的固定状态
 */
function isContextMenuPinned(tab: AdminTabItem) {
  return contextMenuSnapshot.value?.key === tab.key ? contextMenuSnapshot.value.pinned : isTabPinned(tab)
}

/** 唯一标签页始终视为固定
 * @param tab 当前标签页
 * @returns 标签页是否显示为固定
 */
function isTabPinned(tab: AdminTabItem) {
  return props.tabs.length === 1 || Boolean(tab.pinned)
}

/** 切换右键菜单对应的固定状态
 * @param tab 当前标签页
 */
function togglePinned(tab: AdminTabItem) {
  if (props.tabs.length === 1) return
  emit('pin', tab.key, !isContextMenuPinned(tab))
}

/** 请求关闭可关闭的标签页
 * @param key 标签页标识
 */
function closeTab(key: string) {
  const tab = props.tabs.find((tab) => tab.key === key)
  if (!tab || !canCloseTab(tab)) return

  emit('close', key)
}

/** 请求切换到指定标签页
 * @param key 标签页标识
 */
function selectTab(key: string) {
  if (key === props.activeKey) return
  emit('select', key)
}

/** 判断标签页是否允许单独关闭
 * @param tab 当前标签页
 * @returns 是否可以关闭
 */
function canCloseTab(tab: AdminTabItem) {
  return tab.closable !== false && props.tabs.length > 1
}

/** 固定标签保留快捷关闭入口的隐藏与批量关闭保护 */
function isTabQuickClosable(tab: AdminTabItem) {
  return !tab.pinned && canCloseTab(tab)
}

/** 判断批量关闭菜单是否有可操作的标签页
 * @param key 右键选中的标签页标识
 * @param rightOnly 是否只检查该标签右侧
 * @returns 范围内是否存在可关闭的标签页
 */
function hasClosableTabs(key: string, rightOnly: boolean) {
  const index = props.tabs.findIndex((tab) => tab.key === key)
  if (index === -1) return false
  return props.tabs.some((tab, tabIndex) => (rightOnly ? tabIndex > index : tabIndex !== index) && isTabQuickClosable(tab))
}

/** 获取图片图标在指定主题下的地址
 * @param icon 标签页图标
 * @param theme 图标主题
 * @returns 图片地址
 */
function getTabImageIcon(icon: unknown, theme: 'light' | 'dark' = 'light'): string {
  const imageIcon = icon as AdminMenuImageIcon
  return theme === 'light' ? imageIcon.light : (imageIcon.dark ?? imageIcon.light)
}

/** 判断图标是否为明暗主题图片配置
 * @param icon 标签页图标
 * @returns 是否为图片图标
 */
function isTabImageIcon(icon: unknown): icon is AdminMenuImageIcon {
  return typeof icon === 'object' && icon !== null && 'light' in icon
}

/** 判断标签页是否处于激活状态
 * @param tab 当前标签页
 * @returns 是否激活
 */
function isActiveTab(tab: AdminTabItem) {
  return tab.key === props.activeKey
}
</script>

<template>
  <TransitionGroup name="tab-reorder" tag="div" class="tab-reorder-list relative flex h-full min-w-0 flex-1 overflow-x-clip overflow-y-visible" :class="{ 'is-sorting': draggingKey }">
    <div v-for="tab in displayedTabs" :key="tab.key" :data-tab-key="tab.key" :class="['tab-slot relative h-full min-w-0 shrink', { 'is-dragging': draggingKey === tab.key }]">
      <UContextMenu
        :items="[
          [
            {
              label: '重新加载',
              icon: 'i-lucide-refresh-cw',
              onSelect: () => emit('refresh', tab.key),
            },
            {
              label: isContextMenuPinned(tab) ? '取消固定' : '固定',
              icon: isContextMenuPinned(tab) ? 'i-lucide-pin-off' : 'i-lucide-pin',
              disabled: tabs.length === 1,
              onSelect: () => togglePinned(tab),
            },
          ],
          [
            {
              label: '在新标签页打开',
              icon: 'i-lucide-external-link',
              onSelect: () => emit('openBrowserTab', tab.key),
            },
            ...(tab.iframeSrc?.trim()
              ? [
                  {
                    label: '在新标签页打开 iframe 链接',
                    icon: 'i-lucide-external-link',
                    onSelect: () => emit('openIframeSource', tab.key),
                  },
                ]
              : []),
          ],
          [
            {
              label: '关闭',
              disabled: !canCloseTab(tab),
              onSelect: () => closeTab(tab.key),
            },
            {
              label: '关闭其他标签页',
              disabled: !hasClosableTabs(tab.key, false),
              onSelect: () => hasClosableTabs(tab.key, false) && emit('closeOthers', tab.key),
            },
            {
              label: '关闭右侧标签页',
              disabled: !hasClosableTabs(tab.key, true),
              onSelect: () => hasClosableTabs(tab.key, true) && emit('closeRight', tab.key),
            },
          ],
        ]"
        size="sm"
        :ui="{ content: 'z-50', item: 'items-center', itemLeadingIcon: 'size-3.5' }"
        @update:open="captureContextMenuState(tab, $event)"
      >
        <div
          :class="
            cn(
              'tab-item group/tab relative flex h-full w-full min-w-0 cursor-default items-center justify-center select-none',
              isActiveTab(tab) ? cn('is-active z-10 bg-default', tab.showActiveTabBorder ? 'after:bg-border' : 'after:bg-default') : 'hover:bg-elevated hover:dark:bg-default',
            )
          "
          :title="tab.title"
          @click="clickTab($event, tab.key)"
          @pointerdown="startTabPointer($event, tab.key)"
        >
          <div class="flex h-full min-w-0 flex-1 items-center justify-center overflow-hidden">
            <div class="flex h-full w-full min-w-0 items-center overflow-hidden pr-3 pl-3.5">
              <button
                class="tab-select-button flex h-full min-w-0 flex-1 cursor-default items-center text-left"
                type="button"
                :aria-label="tab.title"
                :aria-current="isActiveTab(tab) ? 'page' : undefined"
              >
                <div class="tab-primary-content flex min-w-0 flex-1 items-center overflow-hidden">
                  <UIcon
                    v-if="typeof tab.icon === 'string' && tab.icon.startsWith('i-')"
                    class="tab-leading-icon mr-2 shrink-0 text-muted group-[.is-active]/tab:text-default"
                    :name="tab.icon"
                    size="18"
                  />
                  <picture v-else-if="isTabImageIcon(tab.icon)" class="tab-leading-icon shrink-0">
                    <source media="(prefers-color-scheme: dark)" :srcset="getTabImageIcon(tab.icon, 'dark')" />
                    <img class="mr-2 size-4.5 object-contain" :src="getTabImageIcon(tab.icon)" draggable="false" />
                  </picture>

                  <span class="tab-title min-w-0 flex-1 overflow-hidden text-sm leading-none font-medium whitespace-nowrap text-muted group-[.is-active]/tab:text-default">
                    {{ tab.title }}
                  </span>
                </div>
              </button>

              <button
                v-if="isTabPinned(tab)"
                class="tab-pin-button ml-3 flex size-5 shrink-0 items-center justify-center rounded-full text-muted enabled:hover:bg-accented enabled:hover:text-default group-[.is-active]/tab:text-default disabled:cursor-default disabled:opacity-60"
                type="button"
                :title="tabs.length === 1 ? '唯一标签页不可取消固定' : '取消固定标签页'"
                :aria-label="tabs.length === 1 ? '唯一标签页不可取消固定' : '取消固定标签页'"
                :disabled="tabs.length === 1"
                @click.stop="emit('pin', tab.key, false)"
              >
                <UIcon name="i-lucide-pin" size="14" />
              </button>

              <button
                v-if="isTabQuickClosable(tab)"
                class="tab-close-button ml-3 flex size-5 shrink-0 items-center justify-center rounded-full text-muted hover:bg-accented hover:text-default group-[.is-active]/tab:text-default"
                type="button"
                title="关闭标签页"
                @click.stop="closeTab(tab.key)"
              >
                <UIcon name="i-lucide-x" size="14" />
              </button>
            </div>
          </div>
        </div>
      </UContextMenu>
    </div>
  </TransitionGroup>
</template>

<style lang="scss" scoped>
.tab-slot {
  border-inline-end: 1px solid var(--ui-border);
  flex-basis: 15rem;

  &.is-dragging .tab-item {
    visibility: hidden;
  }
}

.tab-drag-ghost {
  pointer-events: none;
  position: fixed;
  z-index: 2147483647;
  background: var(--ui-bg);
  box-shadow: 0 8px 20px rgb(0 0 0 / 16%);
}

.tab-reorder-move {
  transition: transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.is-sorting .tab-reorder-move {
  transition-duration: 120ms;
}

@media (prefers-reduced-motion: reduce) {
  .tab-reorder-move {
    transition: none;
  }
}

.tab-item {
  container-name: admin-tab;
  container-type: inline-size;
  touch-action: pan-y;

  &:has(.tab-select-button:focus-visible) {
    outline: 2px solid var(--ui-primary);
    outline-offset: -2px;
  }

  .tab-select-button:focus-visible {
    outline: none;
  }

  /* 用伪元素绘制激活指示线，默认收缩为 0，不占用 Tab 的布局空间 */
  &::after {
    pointer-events: none;
    position: absolute;
    inset-inline: 0;
    bottom: -1px;
    height: 1px;
    transform: scaleX(0);
    transform-origin: center;
    content: '';
  }

  /* 标题过长时在右侧渐隐，避免文字直接截断影响关闭按钮的视觉间距 */
  .tab-title {
    mask-image: linear-gradient(to right, black calc(100% - 0.75rem), transparent);
    mask-repeat: no-repeat;
  }

  &.is-active::after {
    transform: scaleX(1);
  }
}

@container admin-tab (max-width: 5.75rem) {
  .tab-close-button {
    display: none;
  }

  .is-active .tab-close-button {
    display: flex;
  }
}

@container admin-tab (max-width: 5.25rem) {
  .is-active .tab-leading-icon {
    display: none;
  }
}

@container admin-tab (max-width: 3.5rem) {
  .is-active .tab-primary-content {
    display: none;
  }

  .is-active .tab-close-button,
  .is-active .tab-pin-button {
    position: absolute;
    top: 50%;
    left: 50%;
    margin: 0;
    transform: translate(-50%, -50%);
  }
}
</style>
