import { describe, it, expect } from 'vitest'
import { computeBestBeforeISO } from '../utils/leftoverUtils'

describe('LeftoverService.computeBestBeforeISO', () => {
  it('applies cooked-rice 4-day cap when product master has cooked-rice tag', () => {
    const createdAt = new Date('2025-01-01T00:00:00.000Z').toISOString()
    const result = computeBestBeforeISO(createdAt, { cooked_rice: true, risk_level: 4 })
    const parsed = new Date(result)
    const expected = new Date('2025-01-05T00:00:00.000Z') // 4 days after Jan 1 -> Jan 5
    expect(parsed.toISOString()).toBe(expected.toISOString())
  })

  it('uses risk_level heuristics when no client override provided', () => {
    const createdAt = new Date('2025-01-01T00:00:00.000Z').toISOString()
    const result = computeBestBeforeISO(createdAt, { risk_level: 5 })
    const parsed = new Date(result)
    // risk_level 5 maps to 2 days by our heuristic
    const expected = new Date('2025-01-03T00:00:00.000Z')
    expect(parsed.toISOString()).toBe(expected.toISOString())
  })
})
