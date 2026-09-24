<script setup lang="ts">
import type { AdminMenuImageIcon, AdminTabItem } from '@monorepo-admin-core/types'
import { cn } from '@monorepo/shared/utils'
import { ref } from 'vue'

const props = defineProps<{
  activeKey: string
  tabs: AdminTabItem[]
}>()

const emit = defineEmits<{
  close: [key: string]
  pin: [key: string, pinned: boolean]
  select: [key: string]
}>()

const contextMenuSnapshot = ref<{ key: string; pinned: boolean } | null>(null)

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
  if (!tab || !isTabClosable(tab)) return

  emit('close', key)
}

/** 请求切换到指定标签页
 * @param key 标签页标识
 */
function selectTab(key: string) {
  if (key === props.activeKey) return
  emit('select', key)
}

/** 判断标签页是否允许关闭
 * @param tab 当前标签页
 * @returns 是否可以关闭
 */
function isTabClosable(tab: AdminTabItem) {
  return !tab.pinned && tab.closable !== false && props.tabs.length > 1
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
  <div class="flex h-full min-w-0 flex-1 overflow-x-clip overflow-y-visible">
    <UContextMenu
      v-for="tab in tabs"
      :key="tab.key"
      :items="[
        {
          label: isContextMenuPinned(tab) ? '取消固定标签页' : '固定标签页',
          icon: isContextMenuPinned(tab) ? 'i-lucide-pin-off' : 'i-lucide-pin',
          disabled: tabs.length === 1,
          onSelect: () => togglePinned(tab),
        },
      ]"
      size="sm"
      :ui="{ content: 'z-50', itemLeadingIcon: 'size-3.5' }"
      @update:open="captureContextMenuState(tab, $event)"
    >
      <div
        :class="
          cn(
            'tab-item group/tab relative flex h-full min-w-0 shrink items-center justify-center select-none',
            isActiveTab(tab) ? cn('is-active z-10 bg-default', tab.showActiveTabBorder ? 'after:bg-border' : 'after:bg-default') : 'hover:bg-elevated hover:dark:bg-default',
          )
        "
        @click="selectTab(tab.key)"
      >
        <div class="flex h-full min-w-0 flex-1 items-center justify-center overflow-hidden">
          <div class="flex w-full min-w-0 items-center overflow-hidden pr-3 pl-3.5">
            <div class="tab-primary-content flex min-w-0 flex-1 items-center overflow-hidden">
              <UIcon
                v-if="typeof tab.icon === 'string' && tab.icon.startsWith('i-')"
                class="tab-leading-icon mr-2 shrink-0 text-muted group-[.is-active]/tab:text-default"
                :name="tab.icon"
                size="18"
              />
              <picture v-else-if="isTabImageIcon(tab.icon)" class="tab-leading-icon shrink-0">
                <source media="(prefers-color-scheme: dark)" :srcset="getTabImageIcon(tab.icon, 'dark')" />
                <img class="mr-2 size-4.5 object-contain" :src="getTabImageIcon(tab.icon)" />
              </picture>

              <span class="tab-title min-w-0 flex-1 overflow-hidden text-sm leading-none font-medium whitespace-nowrap text-muted group-[.is-active]/tab:text-default">
                {{ tab.title }}
              </span>
            </div>

            <button
              v-if="isTabPinned(tab)"
              class="tab-pin-button ml-3 flex size-5 shrink-0 items-center justify-center rounded-full text-muted group-[.is-active]/tab:text-default disabled:cursor-default disabled:opacity-60"
              type="button"
              :title="tabs.length === 1 ? '唯一标签页不可取消固定' : '取消固定标签页'"
              :aria-label="tabs.length === 1 ? '唯一标签页不可取消固定' : '取消固定标签页'"
              :disabled="tabs.length === 1"
              @click.stop="emit('pin', tab.key, false)"
            >
              <UIcon name="i-lucide-pin" size="14" />
            </button>

            <button
              v-if="isTabClosable(tab)"
              class="tab-close-button ml-3 flex size-5 shrink-0 items-center justify-center rounded-full text-muted hover:bg-accented hover:text-default group-[.is-active]/tab:text-default"
              type="button"
              title="关闭标签页"
              @click.stop="closeTab(tab.key)"
            >
              <UIcon name="i-lucide-x" size="14" />
            </button>
          </div>
        </div>

        <span aria-hidden="true" class="pointer-events-none absolute top-0 right-0 -bottom-px z-10 w-px bg-border" />
      </div>
    </UContextMenu>
  </div>
</template>

<style lang="scss" scoped>
.tab-item {
  container-name: admin-tab;
  container-type: inline-size;
  /* 为嵌套的可压缩内容提供基础宽度，避免 Tab 在父级 flex 布局中收缩为 0 */
  flex-basis: 15rem;

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
