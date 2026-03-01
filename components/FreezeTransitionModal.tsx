import React, { useState } from 'react'
import LeftoverService from '../services/leftoverService'

type Props = {
  householdId: string
  inventoryId: string
  onDone?: (res?: any) => void
  onClose?: () => void
}

export default function FreezeTransitionModal({ householdId, inventoryId, onDone, onClose }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [freezerDays, setFreezerDays] = useState<number>(90)

  async function handleConfirm() {
    setLoading(true)
    setError(null)
    try {
      const res = await LeftoverService.moveToFreezer(householdId, inventoryId, { freezerDays })
      setLoading(false)
      onDone?.(res)
      onClose?.()
    } catch (e: any) {
      setLoading(false)
      setError(e?.message || 'Failed to move to freezer')
    }
  }

  return (
    <div style={{ padding: 16, maxWidth: 420, border: '1px solid #eee', borderRadius: 8 }}>
      <h3 style={{ margin: '0 0 8px' }}>Move to Freezer</h3>
      <p style={{ margin: '0 0 12px', color: '#444' }}>Moving this item to the freezer will extend its life. Choose a freezer retention period (days):</p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <input type="number" min={7} value={freezerDays} onChange={e => setFreezerDays(Number(e.target.value) || 90)} style={{ width: 120, padding: 8 }} />
        <div style={{ color: '#666', fontSize: 13 }}>days</div>
      </div>
      {error && <div style={{ color: 'crimson', marginBottom: 12 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onClose} disabled={loading} style={{ padding: '8px 12px' }}>Cancel</button>
        <button onClick={handleConfirm} disabled={loading} style={{ padding: '8px 12px' }}>{loading ? 'Moving…' : 'Move to Freezer'}</button>
      </div>
    </div>
  )
}
