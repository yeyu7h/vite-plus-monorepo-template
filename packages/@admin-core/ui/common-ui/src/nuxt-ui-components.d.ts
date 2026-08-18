declare module 'vue' {
  export interface GlobalComponents {
    UButton: (typeof import('@nuxt/ui/components/Button.vue'))['default']
    UEmpty: (typeof import('@nuxt/ui/components/Empty.vue'))['default']
    UIcon: (typeof import('@nuxt/ui/components/Icon.vue'))['default']
  }
}

export {}
