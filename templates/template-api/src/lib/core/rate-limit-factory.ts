import type { Context } from 'hono'
import type { Store } from 'hono-rate-limiter'
import type { ConnInfo } from 'hono/conninfo'
import type { RedisReply } from 'rate-limit-redis'

import type { BaseBindings } from '@monorepo/server-core'
import { rateLimiter } from 'hono-rate-limiter'
import { RedisStore } from 'rate-limit-redis'

import { z } from 'zod'

import env from '@/env'
import redisClient from '@/lib/services/redis'

/**
 * Runtime detection: check if running in Bun environment
 * 运行时检测：判断是否为 Bun 环境
 */
const isBun = 'Bun' in globalThis

/**
 * Dynamically load `getConnInfo` for the corresponding runtime
 * - Bun: hono/bun
 * - Node.js: @hono/node-server/conninfo
 * 动态加载对应运行时的 `getConnInfo`
 */
const getConnInfo = (await (async () => {
  if (isBun) {
    return (await import('hono/bun')).getConnInfo
  }
  return (await import('@hono/node-server/conninfo')).getConnInfo
})()) as (c: Context) => ConnInfo

function buildRedisStore(prefix: string) {
  return new RedisStore({
    prefix,
    sendCommand: (...args) => {
      const [command, ...commandArgs] = args
      return redisClient.call(command, ...commandArgs) as Promise<RedisReply>
    },
  }) as unknown as Store<BaseBindings>
}

/**
 * IP address validator (Zod v4 - supports IPv4 and IPv6)
 * IP地址验证器 (Zod v4 - 支持 IPv4 和 IPv6)
 */
const ipv4Schema = z.ipv4()
const ipv6Schema = z.ipv6()

/**
 * Validate and return a valid IP address
 * @param ip The IP string to validate / 待验证的IP字符串
 * @returns Returns IP if valid, null if invalid / 验证通过返回IP,失败返回null
 *
 * 验证并返回有效的IP地址
 */
function validateIp(ip: string): string | null {
  // Try IPv4 first / 先尝试 IPv4
  const ipv4Result = ipv4Schema.safeParse(ip)
  if (ipv4Result.success) return ipv4Result.data

  // Then try IPv6 / 再尝试 IPv6
  const ipv6Result = ipv6Schema.safeParse(ip)
  if (ipv6Result.success) return ipv6Result.data

  return null
}

function normalizeIp(ip: string) {
  // Node often provides IPv4-mapped IPv6 / Node 经常给出 IPv4-mapped IPv6
  if (ip.startsWith('::ffff:')) return ip.slice(7)
  return ip
}

/**
 * Get Socket IP via Hono ConnInfo Helper
 * Compatible with Node.js and Bun runtimes
 * 通过 Hono ConnInfo Helper 获取 Socket IP
 * 兼容 Node.js 和 Bun 运行时
 */
function getSocketIp(c: Context<BaseBindings>): string | null {
  try {
    const info = getConnInfo(c)
    const ip = info.remote.address
    return ip ? normalizeIp(ip) : null
  } catch {
    // Tests have no socket (vitest fetch); return null for the caller to handle / 测试环境无 socket（vitest fetch），返回 null 由上层兜底
    return null
  }
}

const TRUSTED_PROXY_IPS = env.TRUSTED_PROXY_IPS.split(',')
  .map((s) => s.trim())
  .filter(Boolean)

// Special modes / 特殊模式：
// - "none" → Trust no proxies (directly exposed port) / 不信任任何代理（直接暴露端口）
// - "private" → Trust private and loopback IPs (1Panel/K8s/Docker container networks, Aliyun SLB, etc.) / 信任私有和回环 IP（1Panel/K8s/Docker 容器网络、阿里云 SLB 等场景）
// - Other values → Trust only exact IP matches / 其他值：仅信任精确匹配的 IP
const TRUST_MODE: 'none' | 'private' | 'list' = (() => {
  if (TRUSTED_PROXY_IPS.length === 1 && TRUSTED_PROXY_IPS[0] === 'none') return 'none'
  if (TRUSTED_PROXY_IPS.length === 1 && TRUSTED_PROXY_IPS[0] === 'private') return 'private'
  return 'list'
})()

if (env.NODE_ENV === 'production' && TRUSTED_PROXY_IPS.length === 0) {
  throw new Error(
    '[Security] 生产环境必须配置 TRUSTED_PROXY_IPS。可选值：' + '(1) 逗号分隔的可信反代 IP 列表；' + '(2) "private" 信任所有私有 IP（容器/K8s/SLB 反代场景推荐）；' + '(3) "none" 直接暴露端口无反代。',
  )
}

function isPrivateIpv4(ip: string) {
  const parts = ip.split('.')
  if (parts.length !== 4) return false

  const nums = parts.map((n) => Number(n))
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false

  const [a, b] = nums

  // RFC1918 + loopback / RFC1918 私有地址和回环地址
  if (a === 10) return true
  if (a === 172 && b !== undefined && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 127) return true

  return false
}

function isPrivateIpv6(ip: string) {
  const lower = ip.toLowerCase()
  // Loopback / 回环地址
  if (lower === '::1') return true

  // Unique local addresses: fc00::/7 / 唯一本地地址：fc00::/7
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true

  // Link-local: fe80::/10 / 链路本地地址：fe80::/10
  if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return true

  return false
}

function isPrivateIp(ip: string) {
  // Note: `normalizeIp` already converts ::ffff:x.x.x.x to IPv4 / 注意：`normalizeIp` 已把 ::ffff:x.x.x.x 转成 IPv4
  return ip.includes('.') ? isPrivateIpv4(ip) : isPrivateIpv6(ip)
}

function isTrustedProxy(ip: string | null) {
  if (!ip) return false

  if (TRUST_MODE === 'none') return false

  if (TRUST_MODE === 'private') return isPrivateIp(ip)

  if (TRUST_MODE === 'list') return TRUSTED_PROXY_IPS.includes(ip)

  // When unconfigured in dev/test, trust private and local addresses for proxy or container debugging / dev/test 未配置时默认信任内网和本机地址，方便本地反代或容器调试
  return isPrivateIp(ip)
}

/**
 * Get client real identifier
 * 获取客户端真实标识
 */
function wrapIpv6(ip: string) {
  return ip.includes(':') ? `v6-${ip.replaceAll(':', '-')}` : ip
}

function getClientIdentifier(c: Context<BaseBindings>) {
  const remoteRaw = getSocketIp(c)
  const remote = remoteRaw ? validateIp(remoteRaw) : null

  // Only read headers from trusted proxies (SLB, Nginx, etc.) / 只有来自可信代理（SLB、Nginx等）才读取头部
  if (remote && isTrustedProxy(remote)) {
    // 1) Prefer X-Real-IP, which SLB overwrites; only read it under a trusted proxy / 1）优先使用 SLB 覆盖的 X-Real-IP；仅在可信代理下读取，防止伪造
    const real = c.req.header('X-Real-IP')
    const realIp = real ? validateIp(normalizeIp(real.trim())) : null
    if (realIp) return wrapIpv6(realIp)

    // 2) Optionally fall back to XFF; the first entry is not recommended unless SLB has sanitized the chain / 2）可选回退到 XFF；除非 SLB 已清洗代理链，否则不建议使用第一个地址
    const xff = c.req.header('X-Forwarded-For')
    if (xff) {
      const parts = xff.split(',').map((s) => normalizeIp(s.trim()))
      // With multiple proxies the rightmost is usually closest, but this is uncertain without a complete trusted proxy list / 多层代理时最右侧通常是最近的代理，但没有完整的可信代理列表时无法绝对确定
      // Conservatively use `parts[0]` only after confirming SLB has sanitized or rewritten XFF / 保守起见，仅在确认 SLB 已清洗或重写 XFF 后使用 `parts[0]`
      const ip = validateIp(parts[0] ?? '')
      if (ip) return wrapIpv6(ip)
    }
  }

  // For an untrusted source, ignore headers and use socket `remoteAddress`, which cannot be forged through headers / 非可信来源忽略头部，直接使用 socket `remoteAddress`，避免通过头部伪造
  if (remote) return wrapIpv6(remote)

  // If all above fail, return 0.0.0.0; this is essentially unreachable in production / 如果以上都失败则返回 0.0.0.0，生产环境中基本走不到这里
  return '0.0.0.0'
}

/**
 * Get the real client IP with trusted proxy validation.
 * Only reads X-Real-IP / X-Forwarded-For when the socket peer is a trusted proxy.
 * 获取客户端真实 IP（带可信代理验证）
 */
export function getClientIp(c: Context): string {
  let remote: string | null = null
  try {
    const remoteRaw = getSocketIp(c as Context<BaseBindings>)
    remote = remoteRaw ? validateIp(remoteRaw) : null
  } catch {
    // `getConnInfo` unavailable (e.g. in tests) — fall through to header check / `getConnInfo` 不可用（如测试环境）时继续检查请求头
  }

  if (remote && isTrustedProxy(remote)) {
    const real = c.req.header('X-Real-IP')
    const realIp = real ? validateIp(normalizeIp(real.trim())) : null
    if (realIp) return realIp

    const xff = c.req.header('X-Forwarded-For')
    if (xff) {
      const ip = validateIp(normalizeIp(xff.split(',')[0]?.trim() ?? ''))
      if (ip) return ip
    }
  }

  return remote ?? 'unknown'
}

/**
 * Rate limit configuration options
 * 速率限制配置选项
 */
export type RateLimitOptions = {
  /** Time window (milliseconds) / 时间窗口(毫秒) */
  windowMs: number
  /** Maximum requests / 最大请求数 */
  limit: number
  /** Redis key prefix — 必须为每个独立桶传不同值，否则多层限流会共用 key 互相计数 */
  prefix: string
  /** Custom key generator (optional, defaults to IP) / 自定义key生成器 (可选,默认使用IP) */
  keyGenerator?: (c: Context<BaseBindings>) => string
  /** Whether to skip counting successful requests (default false) / 是否跳过成功的请求计数 (默认false) */
  skipSuccessfulRequests?: boolean
  /** Whether to skip counting failed requests (default false) / 是否跳过失败的请求计数 (默认false) */
  skipFailedRequests?: boolean
}

/**
 * Create rate limit middleware
 * @param options Rate limit configuration / 速率限制配置
 * @returns Hono middleware / Hono 中间件
 *
 * 创建速率限制中间件
 */
export function createRateLimiter(options: RateLimitOptions) {
  // Skip rate limiting in non-production environments / 非生产环境跳过限流：
  // - test: Tests send rapid requests and a shared socket would quickly trigger 429 for the same IP key / test：用例需要快速连发请求，共享 socket 会导致相同 IP key 迅速触发 429
  // - development: Avoid interrupting frequent local integration work / development：避免频繁的本地联调被限流打断
  if (env.NODE_ENV !== 'production') {
    return async (_c: Context<BaseBindings>, next: () => Promise<void>) => next()
  }

  return rateLimiter({
    windowMs: options.windowMs,
    limit: options.limit,
    standardHeaders: 'draft-6', // Return RateLimit-* response headers / 返回 RateLimit-* 响应头
    keyGenerator: options.keyGenerator ?? getClientIdentifier,
    store: buildRedisStore(options.prefix),
    skipSuccessfulRequests: options.skipSuccessfulRequests ?? false,
    skipFailedRequests: options.skipFailedRequests ?? false,
  })
}
