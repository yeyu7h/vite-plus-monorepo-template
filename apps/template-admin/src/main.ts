import { unmountGlobalLoading } from '@monorepo/vite-plugin-app-loading/runtime'

async function initApplication() {
  const namespace = '123123'

  const { bootstrap } = await import('./bootstrap')
  await bootstrap(namespace)

  unmountGlobalLoading()
}

void initApplication()
