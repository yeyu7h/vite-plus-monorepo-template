import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { sign, verify } from 'hono/jwt'
import { clientPayloadSchema, ClientAuthError } from './contracts'
import type { ClientSession, ClientUser } from './contracts'

export interface ClientSessionStore {
  create(session: ClientSession, refreshHash: string, ttl: number): Promise<void>
  get(sessionId: string): Promise<ClientSession | null>
  rotate(sessionId: string, previousHash: string, nextHash: string): Promise<boolean>
  revoke(sessionId: string): Promise<void>
}

export const hashRefreshToken = (token: string) => createHash('sha256').update(token).digest('hex')

export function createClientSessionService(options: {
  store: ClientSessionStore
  secret: string
  accessSeconds: number
  sessionSeconds: number
  findUser: (id: string) => Promise<ClientUser | null>
}) {
  const { store } = options
  const now = () => Math.floor(Date.now() / 1000)
  const makeRefreshToken = (sessionId: string) => `${sessionId}.${randomBytes(32).toString('hex')}`

  async function tokens(session: ClientSession, refreshToken: string) {
    const iat = now()
    const exp = Math.min(iat + options.accessSeconds, session.expiresAt)
    if (exp <= iat) throw new ClientAuthError()
    const accessToken = await sign({ sub: session.userId, sessionId: session.sessionId, aud: 'client', iss: 'miniapp-client', iat, exp }, options.secret, 'HS256')
    return { accessToken, refreshToken, expiresIn: exp - iat, refreshExpiresIn: session.expiresAt - iat }
  }

  async function create(userId: string, appKey: string) {
    const session: ClientSession = { sessionId: randomUUID(), userId, appKey, expiresAt: now() + options.sessionSeconds }
    const refreshToken = makeRefreshToken(session.sessionId)
    const pair = await tokens(session, refreshToken)
    await store.create(session, hashRefreshToken(refreshToken), options.sessionSeconds)
    return pair
  }

  async function load(sessionId: string): Promise<ClientSession> {
    const session = await store.get(sessionId)
    if (!session || session.sessionId !== sessionId || session.expiresAt <= now()) throw new ClientAuthError()
    return session
  }

  async function userFor(session: ClientSession): Promise<ClientUser> {
    const user = await options.findUser(session.userId)
    if (!user) throw new ClientAuthError()
    return user
  }

  async function authenticate(accessToken: string) {
    let payload: unknown
    try {
      payload = await verify(accessToken, options.secret, { alg: 'HS256', aud: 'client', iss: 'miniapp-client' })
    } catch {
      throw new ClientAuthError()
    }
    const parsed = clientPayloadSchema.safeParse(payload)
    if (!parsed.success) throw new ClientAuthError()
    const session = await load(parsed.data.sessionId)
    if (session.userId !== parsed.data.sub) throw new ClientAuthError()
    const user = await userFor(session)
    return { payload: parsed.data, user }
  }

  async function refresh(refreshToken: string) {
    const match = /^([\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12})\.([\da-f]{64})$/.exec(refreshToken)
    if (!match) throw new ClientAuthError()
    const session = await load(match[1])
    await userFor(session)
    const nextToken = makeRefreshToken(session.sessionId)
    const pair = await tokens(session, nextToken)
    if (!(await store.rotate(session.sessionId, hashRefreshToken(refreshToken), hashRefreshToken(nextToken)))) throw new ClientAuthError()
    return pair
  }

  return { create, authenticate, refresh, revoke: (sessionId: string) => store.revoke(sessionId) }
}
