import React, { useState } from 'react'
import { User, UserProfile } from '../../types'

type Props = {
  user?: User | null
  userProfile?: UserProfile | null
  onChange: (persona: 'relaxed' | 'normal' | 'strict') => void
}

export const LeftoverPersonaQuestionnaire: React.FC<Props> = ({ userProfile, onChange }) => {
  const current = userProfile?.leftoverPersona || 'normal'
  const [showInfo, setShowInfo] = useState(false)

  return (
    <div className="mb-4">
      <div className="flex items-center gap-1 mb-1">
        <label className="block text-xs text-theme-secondary">Food Safety Preference</label>
        <button
          type="button"
          onClick={() => setShowInfo(v => !v)}
          aria-expanded={showInfo}
          aria-label="About Food Safety Preference"
          className="w-4 h-4 rounded-full bg-theme-primary border border-theme text-theme-secondary text-[10px] font-bold leading-none flex items-center justify-center hover:bg-[var(--accent-color)] hover:text-white transition-colors flex-shrink-0"
        >
          i
        </button>
      </div>
      {showInfo && (
        <div className="mb-2 p-2 rounded-lg bg-[var(--accent-color)]/10 border border-[var(--accent-color)]/20 text-xs text-theme-secondary">
          This controls how the app estimates leftover expiry and surfaces safety warnings. <strong className="text-theme-primary">Strict</strong> uses the most conservative FDA-aligned windows. <strong className="text-theme-primary">Normal</strong> follows common household practice. <strong className="text-theme-primary">Relaxed</strong> extends windows slightly — not recommended for immunocompromised individuals.
        </div>
      )}
      <div className="text-sm text-theme-primary mb-2">Choose how conservative you want leftover guidance to be.</div>
      <div className="grid grid-cols-1 gap-2">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="leftoverPersona"
            value="strict"
            checked={current === 'strict'}
            onChange={() => onChange('strict')}
          />
          <div>
            <div className="font-medium">Strict (safety-first)</div>
            <div className="text-xs text-theme-secondary">Shorter recommended windows; conservative advice.</div>
          </div>
        </label>

        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="leftoverPersona"
            value="normal"
            checked={current === 'normal'}
            onChange={() => onChange('normal')}
          />
          <div>
            <div className="font-medium">Normal</div>
            <div className="text-xs text-theme-secondary">Balanced guidance used by most users.</div>
          </div>
        </label>

        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="leftoverPersona"
            value="relaxed"
            checked={current === 'relaxed'}
            onChange={() => onChange('relaxed')}
          />
          <div>
            <div className="font-medium">Relaxed</div>
            <div className="text-xs text-theme-secondary">Slightly more forgiving windows; not for high-risk households.</div>
          </div>
        </label>
      </div>
    </div>
  )
}

export default LeftoverPersonaQuestionnaire
