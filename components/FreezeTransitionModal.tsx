import React, { useState } from 'react'
import FreezerService from '../services/freezerService'

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
  const [freezerZone, setFreezerZone] = useState<string>('middle')
  const [freezerPortionCount, setFreezerPortionCount] = useState<number>(1)
  const [freezerLabelPhotoUrl, setFreezerLabelPhotoUrl] = useState<string>('')

  async function handleConfirm() {
    setLoading(true)
    setError(null)
    try {
      const res = await FreezerService.moveToFreezer(householdId, inventoryId, {
        freezerDays,
        freezerZone,
        freezerPortionCount: freezerPortionCount > 0 ? freezerPortionCount : undefined,
        freezerLabelPhotoUrl: freezerLabelPhotoUrl.trim() || undefined,
      })
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
      <p style={{ margin: '0 0 12px', color: '#444' }}>Moving this item to the freezer will extend its life. Set retention and optional freezer metadata:</p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <input type="number" min={7} value={freezerDays} onChange={e => setFreezerDays(Number(e.target.value) || 90)} style={{ width: 120, padding: 8 }} />
        <div style={{ color: '#666', fontSize: 13 }}>days</div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label htmlFor="freezer-zone" style={{ display: 'block', marginBottom: 6, color: '#444', fontSize: 13 }}>Freezer zone</label>
        <select
          id="freezer-zone"
          value={freezerZone}
          onChange={e => setFreezerZone(e.target.value)}
          style={{ width: '100%', padding: 8 }}
        >
          <option value="top">Top shelf</option>
          <option value="middle">Middle shelf</option>
          <option value="bottom">Bottom shelf</option>
          <option value="door">Door</option>
          <option value="drawer">Drawer/bin</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label htmlFor="freezer-portion" style={{ display: 'block', marginBottom: 6, color: '#444', fontSize: 13 }}>Portion count</label>
        <input
          id="freezer-portion"
          type="number"
          min={1}
          value={freezerPortionCount}
          onChange={e => setFreezerPortionCount(Number(e.target.value) || 1)}
          style={{ width: '100%', padding: 8 }}
        />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label htmlFor="freezer-label" style={{ display: 'block', marginBottom: 6, color: '#444', fontSize: 13 }}>Label photo URL (optional)</label>
        <input
          id="freezer-label"
          type="url"
          value={freezerLabelPhotoUrl}
          onChange={e => setFreezerLabelPhotoUrl(e.target.value)}
          placeholder="https://..."
          style={{ width: '100%', padding: 8 }}
        />
      </div>
      {error && <div style={{ color: 'crimson', marginBottom: 12 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onClose} disabled={loading} style={{ padding: '8px 12px' }}>Cancel</button>
        <button onClick={handleConfirm} disabled={loading} style={{ padding: '8px 12px' }}>{loading ? 'Moving…' : 'Move to Freezer'}</button>
      </div>
    </div>
  )
}
