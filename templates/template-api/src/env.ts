import { existsSync } from 'node:fs'
import path from 'node:path'
import { config } from '@dotenvx/dotenvx'
import { parseEnvOrExit } from '@/utils/zod'
import { envSchema } from './env-schema'

const envFile = path.resolve(process.cwd(), process.env.NODE_ENV === 'test' ? '.env.test' : '.env')
if (existsSync(envFile)) {
  config({ path: envFile })
}

export type { Env } from './env-schema'
export default parseEnvOrExit(envSchema)
