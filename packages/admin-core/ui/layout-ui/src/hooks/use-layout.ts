import { computed } from 'vue'
import type { LayoutProps } from '../layout'
import { platform } from '@monorepo/shared/utils'

export function useLayout(props: LayoutProps) {
  const tabbar = computed(() => props.tabbarEnable && platform.is.desktop)

  return {
    tabbar,
  }
}
