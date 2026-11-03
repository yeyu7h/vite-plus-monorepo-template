import { describe, expect, it } from 'vite-plus/test'
import { formatUserUid } from './uid'

describe('public UID prefix and sequence', () => {
  it('starts with eight padded sequence digits', () => {
    expect(formatUserUid('1', 1n)).toBe('100000001')
  })
  it('grows the sequence without carrying into another prefix', () => {
    expect(formatUserUid('1', 99999999n)).toBe('199999999')
    expect(formatUserUid('1', 100000000n)).toBe('1100000000')
    expect(formatUserUid('2', 100000000n)).toBe('2100000000')
  })
  it('preserves precision above JavaScript safe integers', () => {
    expect(formatUserUid('1', 9007199254740993n)).toBe('19007199254740993')
  })
  it.each(['0', '10', 'x', ''])('rejects invalid or overlapping prefix %s', (prefix) => {
    expect(() => formatUserUid(prefix, 1n)).toThrow(RangeError)
  })
  it.each([0n, -1n])('rejects sequence %s', (sequence) => {
    expect(() => formatUserUid('1', sequence)).toThrow(RangeError)
  })
})
