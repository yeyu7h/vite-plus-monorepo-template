import { computed } from 'vue'
import type { AdminLayoutProps } from '../admin-layout'

export function useLayout(props: AdminLayoutProps) {
  const tabbar = computed(() => props.tabbarEnable)

  return {
    tabbar,
  }
}
