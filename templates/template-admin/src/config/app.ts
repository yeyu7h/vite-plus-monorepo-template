import { useAdminAppConfig } from '@monorepo-admin-core/hooks'

const adminAppConfig = useAdminAppConfig(import.meta.env, import.meta.env.PROD)

function resolveAdminApiURL(path: string) {
  const apiURL = adminAppConfig.apiURL.replace(/\/+$/, '')
  const normalizedPath = path.replace(/^\/+/, '')

  return `${apiURL}/${normalizedPath}`
}

export { adminAppConfig, resolveAdminApiURL }
