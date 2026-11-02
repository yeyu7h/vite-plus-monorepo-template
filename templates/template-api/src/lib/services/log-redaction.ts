const REDACTED = '[REDACTED]'
const sensitiveFields = new Set([
  'password',
  'passwordhash',
  'passwd',
  'pwd',
  'oldpassword',
  'currentpassword',
  'newpassword',
  'confirmpassword',
  'token',
  'accesstoken',
  'refreshtoken',
  'captchatoken',
  'authorization',
  'cookie',
  'setcookie',
  'secret',
  'clientsecret',
  'secretaccesskey',
  'apikey',
])

function redactValue(value: unknown, seen: WeakMap<object, unknown>): unknown {
  if (!value || typeof value !== 'object') return value
  if (seen.has(value)) return seen.get(value)
  if (Array.isArray(value)) {
    const result: unknown[] = []
    seen.set(value, result)
    for (const item of value) result.push(redactValue(item, seen))
    return result
  }
  if (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null) {
    return redactObject(value as Record<string, unknown>, seen)
  }
  return value
}

/** Copy log data before redaction so request/response objects stay intact. */
export function redactLogObject(value: Record<string, unknown>): Record<string, unknown> {
  return redactObject(value, new WeakMap())
}

function redactObject(value: Record<string, unknown>, seen: WeakMap<object, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = Object.create(null)
  seen.set(value, result)
  for (const [key, item] of Object.entries(value)) {
    result[key] = sensitiveFields.has(key.replace(/[-_]/g, '').toLowerCase()) ? REDACTED : redactValue(item, seen)
  }
  return result
}
