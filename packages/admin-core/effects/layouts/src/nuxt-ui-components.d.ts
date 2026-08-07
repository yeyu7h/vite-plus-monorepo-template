declare module 'vue' {
  export interface GlobalComponents {
    UButton: (typeof import('@nuxt/ui/components/Button.vue'))['default']
    UCard: (typeof import('@nuxt/ui/components/Card.vue'))['default']
    UCollapsible: (typeof import('@nuxt/ui/components/Collapsible.vue'))['default']
    UDashboardGroup: (typeof import('@nuxt/ui/components/DashboardGroup.vue'))['default']
    UDashboardSidebar: (typeof import('@nuxt/ui/components/DashboardSidebar.vue'))['default']
    UDashboardPanel: (typeof import('@nuxt/ui/components/DashboardPanel.vue'))['default']
    UDashboardNavbar: (typeof import('@nuxt/ui/components/DashboardNavbar.vue'))['default']
    UNavigationMenu: (typeof import('@nuxt/ui/components/NavigationMenu.vue'))['default']
    UDashboardToolbar: (typeof import('@nuxt/ui/components/DashboardToolbar.vue'))['default']
    UBreadcrumb: (typeof import('@nuxt/ui/components/Breadcrumb.vue'))['default']
    UIcon: (typeof import('@nuxt/ui/components/Icon.vue'))['default']
  }
}

export {}
