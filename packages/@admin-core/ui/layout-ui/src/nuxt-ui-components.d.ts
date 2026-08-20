declare module 'vue' {
  export interface GlobalComponents {
    UButton: (typeof import('@nuxt/ui/components/Button.vue'))['default']
    UDashboardNavbar: (typeof import('@nuxt/ui/components/DashboardNavbar.vue'))['default']
  }
}

export {}
