import React, { useState } from 'react'
import { Milk, Beef } from 'lucide-react'
import RiskProfileService from '../../services/riskProfileService'

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
    <div className="max-w-2xl mx-auto p-5">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2 text-theme-primary">🍽️ Vibe Check</h2>
        <p className="text-theme-secondary text-base">
          Let's find your food safety style with a couple quick scenarios
        </p>
      </div>

      {/* Milk Scenario */}
      <div className="bg-theme-secondary rounded-xl p-6 mb-8 border border-theme">
        <div className="flex items-center mb-4">
          <Milk className="w-6 h-6 mr-3 text-blue-500" />
          <h3 className="m-0 text-lg font-semibold text-theme-primary">The Milk Test</h3>
        </div>

        <p className="m-0 mb-5 text-theme-secondary leading-relaxed">
          The milk expired yesterday. It smells fine. What do you do?
        </p>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setMilkResponse('A')}
            className={`p-4 border rounded-lg text-left cursor-pointer transition-all ${
              milkResponse === 'A'
                ? 'border-green-500 bg-green-100 text-gray-900'
                : 'border-theme bg-white text-black hover:bg-green-100'
            }`}
          >
            <div className="font-semibold mb-1">🛡️ Toss it immediately.</div>
            <div className="text-sm text-black">The Purist</div>
          </button>

          <button
            type="button"
            onClick={() => setMilkResponse('B')}
            className={`p-4 border rounded-lg text-left cursor-pointer transition-all ${
              milkResponse === 'B'
                ? 'border-green-500 bg-green-100 text-gray-900'
                : 'border-theme bg-white text-black hover:bg-green-100'
            }`}
          >
            <div className="font-semibold mb-1">🥣 Use it in cereal today.</div>
            <div className="text-sm text-black">The Pragmatist</div>
          </button>

          <button
            type="button"
            onClick={() => setMilkResponse('C')}
            className={`p-4 border rounded-lg text-left cursor-pointer transition-all ${
              milkResponse === 'C'
                ? 'border-green-500 bg-green-100 text-gray-900'
                : 'border-theme bg-white text-black hover:bg-green-100'
            }`}
          >
            <div className="font-semibold mb-1">⏰ It's fine for another 3 days.</div>
            <div className="text-sm text-black">The Adventurer</div>
          </button>
        </div>
      </div>

      {/* Meat Scenario */}
      <div className="bg-theme-secondary rounded-xl p-6 mb-8 border border-theme">
        <div className="flex items-center mb-4">
          <Beef className="w-6 h-6 mr-3 text-red-500" />
          <h3 className="m-0 text-lg font-semibold text-theme-primary">The Meat Test</h3>
        </div>

        <p className="m-0 mb-5 text-theme-secondary leading-relaxed">
          The chicken is at its "Use By" date. You aren't cooking it until tomorrow.
        </p>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setMeatResponse('A')}
            className={`p-4 border rounded-lg text-left cursor-pointer transition-all ${
              meatResponse === 'A'
                ? 'border-green-500 bg-green-100 text-gray-900'
                : 'border-theme bg-white text-black hover:bg-green-100'
            }`}
          >
            <div className="font-semibold mb-1">🗑️ Into the trash.</div>
            <div className="text-sm text-black">The Purist</div>
          </button>

          <button
            type="button"
            onClick={() => setMeatResponse('B')}
            className={`p-4 border rounded-lg text-left cursor-pointer transition-all ${
              meatResponse === 'B'
                ? 'border-green-500 bg-green-100 text-gray-900'
                : 'border-theme bg-white text-black hover:bg-green-100'
            }`}
          >
            <div className="font-semibold mb-1">🧊 Move it to the freezer NOW.</div>
            <div className="text-sm text-black">The Pragmatist</div>
          </button>

          <button
            type="button"
            onClick={() => setMeatResponse('C')}
            className={`p-4 border rounded-lg text-left cursor-pointer transition-all ${
              meatResponse === 'C'
                ? 'border-green-500 bg-green-100 text-gray-900'
                : 'border-theme bg-white text-black hover:bg-green-100'
            }`}
          >
            <div className="font-semibold mb-1">😎 It'll be fine in the fridge one more night.</div>
            <div className="text-sm text-black">The Adventurer</div>
          </button>
        </div>
      </div>

      {error && <div className="text-red-500 mb-4 text-center">{error}</div>}

      <div className="flex justify-center gap-3">
        <button
          type="button"
          onClick={() => onComplete?.(3)} // Default moderate risk level
          disabled={loading}
          className="px-6 py-3 border border-theme rounded-lg bg-theme-primary text-theme-primary cursor-pointer hover:bg-theme-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Skip
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading || !canProceed}
          className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
            canProceed && !loading
              ? 'bg-blue-500 hover:bg-blue-600 text-white cursor-pointer'
              : 'bg-gray-400 text-gray-200 cursor-not-allowed'
          }`}
        >
          {loading ? 'Saving…' : 'Complete Setup'}
        </button>
      </div>
    </div>
  )
}
