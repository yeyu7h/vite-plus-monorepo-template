import { computed } from 'vue'
import type { LayoutProps } from '../layout'

export function useLayout(props: LayoutProps) {
  const tabbar = computed(() => props.tabbarEnable)

  return {
    tabbar,
  }
}
