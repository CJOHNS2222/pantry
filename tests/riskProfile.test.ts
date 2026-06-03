import { describe, it, expect } from 'vitest'
import RiskProfileService from '../services/riskProfileService'

describe('RiskProfileService.computeRiskLevelFromAnswers', () => {
  it('computes highest risk for immunocompromised', () => {
    const level = RiskProfileService.computeRiskLevelFromAnswers({ immunocompromised: true })
    expect(level).toBeGreaterThanOrEqual(4)
  })

  it('computes moderate risk for infant + elderly', () => {
    const level = RiskProfileService.computeRiskLevelFromAnswers({ householdHasInfant: true, householdHasElderly: true })
    expect(level).toBeGreaterThanOrEqual(2)
    expect(level).toBeLessThanOrEqual(4)
  })

  it('clamps between 1 and 5', () => {
    const level = RiskProfileService.computeRiskLevelFromAnswers({ immunocompromised: true, householdHasInfant: true, householdHasElderly: true, preferStrict: true })
    expect(level).toBeLessThanOrEqual(5)
    expect(level).toBeGreaterThanOrEqual(1)
  })
})
