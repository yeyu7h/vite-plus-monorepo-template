declare module 'vue' {
  export interface GlobalComponents {
    UButton: (typeof import('@nuxt/ui/components/Button.vue'))['default']
    UCard: (typeof import('@nuxt/ui/components/Card.vue'))['default']
    UCollapsible: (typeof import('@nuxt/ui/components/Collapsible.vue'))['default']
    UBreadcrumb: (typeof import('@nuxt/ui/components/Breadcrumb.vue'))['default']
    UIcon: (typeof import('@nuxt/ui/components/Icon.vue'))['default']
  }
}

export {}
