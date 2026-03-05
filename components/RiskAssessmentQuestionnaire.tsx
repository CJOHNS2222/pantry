import React, { useState } from 'react'
import { Milk, Beef } from 'lucide-react'
import RiskProfileService from '../services/riskProfileService'

type Props = {
  userId: string
  onComplete?: (riskLevel: number, preferStrict?: boolean) => void
}

type ScenarioResponse = 'A' | 'B' | 'C' | null

export default function RiskAssessmentQuestionnaire({ userId, onComplete }: Props) {
  const [milkResponse, setMilkResponse] = useState<ScenarioResponse>(null)
  const [meatResponse, setMeatResponse] = useState<ScenarioResponse>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function computeRiskLevel(): number {
    // Risk level mapping based on scenario responses
    // A = Purist (conservative, risk level 5)
    // B = Pragmatist (moderate, risk level 3)
    // C = Adventurer (risk-taking, risk level 1)

    const responses = [milkResponse, meatResponse].filter(r => r !== null)

    if (responses.length === 0) return 3 // Default moderate

    // Count responses
    const aCount = responses.filter(r => r === 'A').length
    const bCount = responses.filter(r => r === 'B').length
    const cCount = responses.filter(r => r === 'C').length

    // Determine overall risk level
    if (aCount >= 1) return 5 // Any conservative response = high risk level
    if (bCount >= 1) return 3 // Any moderate response = moderate risk level
    if (cCount >= 1) return 1 // Risk-taking responses = low risk level

    return 3 // Default
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault()
    setLoading(true)
    setError(null)
    const level = computeRiskLevel()
    try {
      // Save risk level to user's profile
      await RiskProfileService.setUserRiskLevel(userId, level)
      setLoading(false)
      onComplete?.(level, false) // No longer using preferStrict
    } catch (err: any) {
      setLoading(false)
      setError(err?.message || 'Failed to save')
    }
  }

  const canProceed = milkResponse !== null && meatResponse !== null

  return (
    <div style={{ padding: 20, maxWidth: 600, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: 'bold' }}>🍽️ Vibe Check</h2>
        <p style={{ margin: 0, color: '#666', fontSize: '16px' }}>
          Let's find your food safety style with a couple quick scenarios
        </p>
      </div>

      {/* Milk Scenario */}
      <div style={{
        background: '#f8f9fa',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '24px',
        border: '1px solid #e9ecef'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
          <Milk style={{ width: '24px', height: '24px', marginRight: '12px', color: '#007bff' }} />
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>The Milk Test</h3>
        </div>

        <p style={{ margin: '0 0 20px 0', color: '#555', lineHeight: '1.5' }}>
          The milk expired yesterday. It smells fine. What do you do?
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
            type="button"
            onClick={() => setMilkResponse('A')}
            style={{
              padding: '16px',
              border: milkResponse === 'A' ? '2px solid #007bff' : '1px solid #ddd',
              borderRadius: '8px',
              background: milkResponse === 'A' ? '#e7f3ff' : 'white',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <div style={{ fontWeight: '600', marginBottom: '4px' }}>🛡️ Toss it immediately.</div>
            <div style={{ fontSize: '14px', color: '#666' }}>The Purist</div>
          </button>

          <button
            type="button"
            onClick={() => setMilkResponse('B')}
            style={{
              padding: '16px',
              border: milkResponse === 'B' ? '2px solid #007bff' : '1px solid #ddd',
              borderRadius: '8px',
              background: milkResponse === 'B' ? '#e7f3ff' : 'white',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <div style={{ fontWeight: '600', marginBottom: '4px' }}>🥣 Use it in cereal today.</div>
            <div style={{ fontSize: '14px', color: '#666' }}>The Pragmatist</div>
          </button>

          <button
            type="button"
            onClick={() => setMilkResponse('C')}
            style={{
              padding: '16px',
              border: milkResponse === 'C' ? '2px solid #007bff' : '1px solid #ddd',
              borderRadius: '8px',
              background: milkResponse === 'C' ? '#e7f3ff' : 'white',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <div style={{ fontWeight: '600', marginBottom: '4px' }}>⏰ It's fine for another 3 days.</div>
            <div style={{ fontSize: '14px', color: '#666' }}>The Adventurer</div>
          </button>
        </div>
      </div>

      {/* Meat Scenario */}
      <div style={{
        background: '#f8f9fa',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '32px',
        border: '1px solid #e9ecef'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
          <Beef style={{ width: '24px', height: '24px', marginRight: '12px', color: '#dc3545' }} />
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>The Meat Test</h3>
        </div>

        <p style={{ margin: '0 0 20px 0', color: '#555', lineHeight: '1.5' }}>
          The chicken is at its "Use By" date. You aren't cooking it until tomorrow.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
            type="button"
            onClick={() => setMeatResponse('A')}
            style={{
              padding: '16px',
              border: meatResponse === 'A' ? '2px solid #007bff' : '1px solid #ddd',
              borderRadius: '8px',
              background: meatResponse === 'A' ? '#e7f3ff' : 'white',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <div style={{ fontWeight: '600', marginBottom: '4px' }}>🗑️ Into the trash.</div>
            <div style={{ fontSize: '14px', color: '#666' }}>The Purist</div>
          </button>

          <button
            type="button"
            onClick={() => setMeatResponse('B')}
            style={{
              padding: '16px',
              border: meatResponse === 'B' ? '2px solid #007bff' : '1px solid #ddd',
              borderRadius: '8px',
              background: meatResponse === 'B' ? '#e7f3ff' : 'white',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <div style={{ fontWeight: '600', marginBottom: '4px' }}>🧊 Move it to the freezer NOW.</div>
            <div style={{ fontSize: '14px', color: '#666' }}>The Pragmatist</div>
          </button>

          <button
            type="button"
            onClick={() => setMeatResponse('C')}
            style={{
              padding: '16px',
              border: meatResponse === 'C' ? '2px solid #007bff' : '1px solid #ddd',
              borderRadius: '8px',
              background: meatResponse === 'C' ? '#e7f3ff' : 'white',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <div style={{ fontWeight: '600', marginBottom: '4px' }}>😎 It'll be fine in the fridge one more night.</div>
            <div style={{ fontSize: '14px', color: '#666' }}>The Adventurer</div>
          </button>
        </div>
      </div>

      {error && <div style={{ color: 'crimson', marginBottom: 16, textAlign: 'center' }}>{error}</div>}

      <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
        <button
          type="button"
          onClick={() => onComplete?.(3)} // Default moderate risk level
          disabled={loading}
          style={{
            padding: '12px 24px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            background: 'white',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          Skip
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading || !canProceed}
          style={{
            padding: '12px 24px',
            border: 'none',
            borderRadius: '8px',
            background: canProceed ? '#007bff' : '#ccc',
            color: 'white',
            cursor: canProceed ? 'pointer' : 'not-allowed',
            fontSize: '16px',
            fontWeight: '600'
          }}
        >
          {loading ? 'Saving…' : 'Complete Setup'}
        </button>
      </div>
    </div>
  )
}
