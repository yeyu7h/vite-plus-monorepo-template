import { jwt } from 'hono/jwt'
import env from '@/env'
import { ADMIN_JWT_AUDIENCE, ADMIN_JWT_ISSUER } from '@/lib/constants/jwt'

export const createAdminJwt = () =>
  jwt({
    secret: env.ADMIN_JWT_SECRET,
    alg: 'HS256',
    verification: { aud: ADMIN_JWT_AUDIENCE, iss: ADMIN_JWT_ISSUER },
  })
