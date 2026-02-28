import React, { useState } from 'react'
import LeftoverService, { LeftoverCreate } from '../services/leftoverService'

type Props = {
  householdId: string
  userId: string
  onSaved?: (id: string) => void
  onClose?: () => void
}

export default function LeftoverQuickCapture({ householdId, userId, onSaved, onClose }: Props) {
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(undefined)
  const [servings, setServings] = useState<number>(1)
  const [notes, setNotes] = useState('')
  const [isCooked, setIsCooked] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setLoading(true)
    setError(null)
    const payload: LeftoverCreate = {
      householdId,
      createdBy: userId,
      photoUrl,
      servings,
      notes,
      productMasterTags: isCooked ? ['cooked-rice'] : undefined,
      productMasterRiskLevel: isCooked ? 4 : undefined,
    }

    try {
      const doc = await LeftoverService.createLeftover(payload)
      setLoading(false)
      onSaved?.(doc.id)
      onClose?.()
    } catch (e: any) {
      setLoading(false)
      setError(e?.message || 'Save failed')
    }
  }

  return (
    <div style={{ padding: 12, maxWidth: 480 }}>
      <h3 style={{ margin: '4px 0' }}>Save Leftover</h3>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <div style={{ width: 96, height: 72, background: '#f5f5f5', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {photoUrl ? <img src={photoUrl} alt="leftover" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6 }} /> : <span style={{ color: '#888' }}>Photo</span>}
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: 12, color: '#444' }}>Servings</label>
          <input type="number" min={1} value={servings} onChange={(e) => setServings(Number(e.target.value))} style={{ width: 80, padding: 6 }} />
        </div>
      </div>

      <div style={{ marginBottom: 8 }}>
        <label style={{ display: 'block', fontSize: 12, color: '#444' }}>Notes (optional)</label>
        <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} style={{ width: '100%', padding: 8 }} />
      </div>

      <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
        <input id="cooked-checkbox" type="checkbox" checked={isCooked} onChange={(e) => setIsCooked(e.target.checked)} />
        <label htmlFor="cooked-checkbox" style={{ fontSize: 13, color: '#333' }}>Mark as cooked (shorter safety window)</label>
      </div>

      {error && <div style={{ color: 'crimson', marginBottom: 8 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onClose} style={{ padding: '8px 12px' }} disabled={loading}>Cancel</button>
        <button onClick={handleSave} style={{ padding: '8px 12px' }} disabled={loading}>{loading ? 'Saving…' : 'Save'}</button>
      </div>
    </div>
  )
}
