/** The fixed-width prefix is independent from the login provider and user roles. */
export function formatUserUid(prefix: string, sequence: bigint): string {
  if (!/^[1-9]$/.test(prefix)) throw new RangeError('UID prefix must be one digit from 1 to 9')
  if (sequence < 1n) throw new RangeError('UID sequence must be positive')
  return prefix + sequence.toString().padStart(8, '0')
}
