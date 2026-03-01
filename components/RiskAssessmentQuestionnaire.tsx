import React, { useState } from 'react'
import RiskProfileService from '../services/riskProfileService'

type Props = {
  userId: string
  onComplete?: (riskLevel: number, preferStrict?: boolean) => void
}

export default function RiskAssessmentQuestionnaire({ userId, onComplete }: Props) {
  const [immunocompromised, setImmunocompromised] = useState(false)
  const [householdHasInfant, setHouseholdHasInfant] = useState(false)
  const [householdHasElderly, setHouseholdHasElderly] = useState(false)
  const [preferStrict, setPreferStrict] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function computeRiskLevel() {
    return RiskProfileService.computeRiskLevelFromAnswers({
      immunocompromised,
      householdHasInfant,
      householdHasElderly,
      preferStrict
    })
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault()
    setLoading(true)
    setError(null)
    const level = computeRiskLevel()
    try {
      // Delegate persistence to caller via onComplete so the hook can manage UI state
      await Promise.resolve()
      setLoading(false)
      onComplete?.(level, preferStrict)
    } catch (err: any) {
      setLoading(false)
      setError(err?.message || 'Failed to save')
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ padding: 12, maxWidth: 540 }}>
      <h3 style={{ margin: '4px 0' }}>Safety preferences</h3>
      <p style={{ marginTop: 0, color: '#555' }}>A few quick questions to tailor notifications for food safety.</p>

      <label style={{ display: 'block', marginBottom: 8 }}>
        <input type="checkbox" checked={immunocompromised} onChange={e => setImmunocompromised(e.target.checked)} />{' '}
        Someone in my household is immunocompromised
      </label>

      <label style={{ display: 'block', marginBottom: 8 }}>
        <input type="checkbox" checked={householdHasInfant} onChange={e => setHouseholdHasInfant(e.target.checked)} />{' '}
        Household includes an infant (0-2 years)
      </label>

      <label style={{ display: 'block', marginBottom: 8 }}>
        <input type="checkbox" checked={householdHasElderly} onChange={e => setHouseholdHasElderly(e.target.checked)} />{' '}
        Household includes older adults (65+)
      </label>

      <label style={{ display: 'block', marginBottom: 12 }}>
        <input type="checkbox" checked={preferStrict} onChange={e => setPreferStrict(e.target.checked)} />{' '}
        I prefer stricter safety alerts (avoid borderline items)
      </label>

      {error && <div style={{ color: 'crimson', marginBottom: 8 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={() => { const level = computeRiskLevel(); onComplete?.(level) }} disabled={loading} style={{ padding: '8px 12px' }}>Skip</button>
        <button type="submit" disabled={loading} style={{ padding: '8px 12px' }}>{loading ? 'Saving…' : 'Save preferences'}</button>
      </div>
    </form>
  )
}
