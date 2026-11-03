import { randomUUID } from 'node:crypto'
import { sign, decode } from 'hono/jwt'
import { describe, expect, it, vi, afterEach } from 'vite-plus/test'
import { createClientSessionService, hashRefreshToken } from './sessions'
import type { ClientSessionStore } from './sessions'
import type { ClientSession, ClientUser } from './contracts'
import { ClientAuthError } from './contracts'

afterEach(() => vi.useRealTimers())
const secret = 'client-session-test-secret-at-least-32-characters'

function setup() {
  const user: ClientUser = { id: randomUUID(), uid: '100000001', nickname: '用户', avatar: null, createdAt: null }
  const sessions = new Map<string, ClientSession>()
  const hashes = new Set<string>()
  const store: ClientSessionStore = {
    async create(session, hash) {
      sessions.set(session.sessionId, session)
      hashes.add(hash)
    },
    async get(id) {
      return sessions.get(id) ?? null
    },
    async rotate(id, previous, next) {
      if (!sessions.has(id) || !hashes.delete(previous)) return false
      hashes.add(next)
      return true
    },
    async revoke(id) {
      sessions.delete(id)
    },
  }
  const findUser = vi.fn<(id: string) => Promise<ClientUser | null>>().mockResolvedValue(user)
  const service = createClientSessionService({ store, secret, accessSeconds: 900, sessionSeconds: 604800, findUser })
  return { service, user, store, findUser, hashes, sessions }
}

describe('client login sessions', () => {
  it('issues client-scoped JWTs and stores only the hash of the refresh credential', async () => {
    const { service, user, hashes } = setup()
    const pair = await service.create(user.id, 'wx')
    expect(decode(pair.accessToken).payload).toMatchObject({ sub: user.id, aud: 'client', iss: 'miniapp-client' })
    expect(hashes.has(pair.refreshToken)).toBe(false)
    expect(hashes.has(hashRefreshToken(pair.refreshToken))).toBe(true)
    expect((await service.authenticate(pair.accessToken)).user).toEqual(user)
  })

  it('allows only one winner when the same refresh token is used concurrently', async () => {
    const { service, user } = setup()
    const pair = await service.create(user.id, 'wx')
    const results = await Promise.allSettled([service.refresh(pair.refreshToken), service.refresh(pair.refreshToken)])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1)
    await expect(service.refresh(pair.refreshToken)).rejects.toBeInstanceOf(ClientAuthError)
  })

  it('invalidates access and refresh credentials on logout without affecting another device', async () => {
    const { service, user } = setup()
    const first = await service.create(user.id, 'wx')
    const second = await service.create(user.id, 'ali')
    const authenticated = await service.authenticate(first.accessToken)
    await service.revoke(authenticated.payload.sessionId)
    await expect(service.authenticate(first.accessToken)).rejects.toBeInstanceOf(ClientAuthError)
    await expect(service.refresh(first.refreshToken)).rejects.toBeInstanceOf(ClientAuthError)
    expect((await service.authenticate(second.accessToken)).user.id).toBe(user.id)
  })

  it('rejects disabled or deleted accounts on access and refresh', async () => {
    const { service, user, findUser } = setup()
    const pair = await service.create(user.id, 'wx')
    findUser.mockRejectedValue(new ClientAuthError('disabled'))
    await expect(service.authenticate(pair.accessToken)).rejects.toMatchObject({ reason: 'disabled' })
    await expect(service.refresh(pair.refreshToken)).rejects.toMatchObject({ reason: 'disabled' })
    findUser.mockResolvedValue(null)
    await expect(service.authenticate(pair.accessToken)).rejects.toBeInstanceOf(ClientAuthError)
  })

  it('rejects an admin audience even with the same signing secret and an existing client session', async () => {
    const { service, user } = setup()
    const pair = await service.create(user.id, 'wx')
    const payload = decode(pair.accessToken).payload
    const adminToken = await sign({ ...payload, aud: 'admin' }, secret, 'HS256')
    await expect(service.authenticate(adminToken)).rejects.toBeInstanceOf(ClientAuthError)
  })

  it('rejects a forged refresh credential and a mismatched JWT subject', async () => {
    const { service, user } = setup()
    const pair = await service.create(user.id, 'wx')
    const forged = pair.refreshToken.slice(0, -1) + (pair.refreshToken.endsWith('0') ? '1' : '0')
    await expect(service.refresh(forged)).rejects.toBeInstanceOf(ClientAuthError)
    const wrongSubject = await sign({ ...decode(pair.accessToken).payload, sub: randomUUID() }, secret, 'HS256')
    await expect(service.authenticate(wrongSubject)).rejects.toBeInstanceOf(ClientAuthError)
  })

  it('allows refresh after access expiration but never extends the absolute session lifetime', async () => {
    vi.useFakeTimers()
    const { service, user } = setup()
    const pair = await service.create(user.id, 'wx')
    vi.advanceTimersByTime(901000)
    await expect(service.authenticate(pair.accessToken)).rejects.toBeInstanceOf(ClientAuthError)
    const next = await service.refresh(pair.refreshToken)
    expect(next.refreshExpiresIn).toBe(604800 - 901)
    expect((await service.authenticate(next.accessToken)).user.id).toBe(user.id)
    vi.advanceTimersByTime(604800000)
    await expect(service.refresh(next.refreshToken)).rejects.toBeInstanceOf(ClientAuthError)
  })
})
