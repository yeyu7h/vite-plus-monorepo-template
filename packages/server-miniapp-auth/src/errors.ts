export type MiniappAuthErrorCode = 'APP_NOT_CONFIGURED' | 'INVALID_CODE' | 'PROVIDER_UNAVAILABLE' | 'INVALID_PROVIDER_RESPONSE'

/** Intentionally excludes upstream errors, response bodies, codes and credentials. */
export class MiniappAuthError extends Error {
  readonly code: MiniappAuthErrorCode

  constructor(code: MiniappAuthErrorCode) {
    super(code)
    this.name = 'MiniappAuthError'
    this.code = code
  }
}
