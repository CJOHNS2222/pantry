import React from 'react'
import { User, UserProfile } from '../types'

type Props = {
  user?: User | null
  userProfile?: UserProfile | null
  onChange: (persona: 'relaxed' | 'normal' | 'strict') => void
}

export const LeftoverPersonaQuestionnaire: React.FC<Props> = ({ userProfile, onChange }) => {
  const current = userProfile?.leftoverPersona || 'normal'

  return (
    <div className="mb-4">
      <label className="block text-xs text-theme-secondary mb-1">Food Safety Preference</label>
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
