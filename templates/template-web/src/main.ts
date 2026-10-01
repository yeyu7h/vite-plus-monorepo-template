import { createApp } from 'vue'
import NuxtUI from '@nuxt/ui/vue-plugin'
import App from './App.vue'
import { router } from './router'
import './styles/main.css'

createApp(App).use(router).use(NuxtUI).mount('#app')
