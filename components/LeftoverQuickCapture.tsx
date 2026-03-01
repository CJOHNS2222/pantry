import React, { useState } from 'react'
import LeftoverService, { simpleAddOrMarkLeftover } from '../services/leftoverService'
import { useApp } from '../contexts/AppContext'
import { uploadLeftoverImage } from '../services/leftoverImageService'
import DatabaseMonitoringService from '../services/databaseMonitoringService'

type Props = {
  householdId: string
  createdBy: string
  sourcePantryItemId?: string
  onSaved?: (id: string) => void
  onClose?: () => void
}

export default function LeftoverQuickCapture({ householdId, createdBy, sourcePantryItemId, onSaved, onClose }: Props) {
  const { user } = useApp()
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(undefined)
  const [file, setFile] = useState<File | null>(null)
  const [updateItemPicture, setUpdateItemPicture] = useState(false)
  const [servings, setServings] = useState<number>(1)
  const [notes, setNotes] = useState('')
  const [isCooked, setIsCooked] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setLoading(true)
    setError(null)

    // If a file was selected, upload first and use the resulting URL
    try {
      if (file) {
        // Default to household-scoped cache for quick-capture to avoid public sharing
        const uploaded = await uploadLeftoverImage(file, householdId, notes || 'leftover', 'household', user?.id)
        setPhotoUrl(uploaded)
      }
    } catch (err: any) {
      console.warn('Image upload failed, continuing without photo', err)
    }
    // If this leftover is linked to an existing pantry item, prefer item-level hints
    // (tags, risk level, is_immortal) so we don't need an extra product_master lookup.
    let inferredTags: string[] | undefined = undefined
    let inferredRiskLevel: number | undefined = undefined
    let inferredIsImmortal: boolean | undefined = undefined

    if (sourcePantryItemId) {
      try {
        const itemRef = DatabaseMonitoringService.doc(`households/${householdId}/inventory`, sourcePantryItemId)
        const itemSnap = await DatabaseMonitoringService.getDoc(itemRef)
        if (itemSnap && itemSnap.exists && typeof itemSnap.exists === 'function' ? itemSnap.exists() : itemSnap.exists) {
          const itemData = (itemSnap.data && typeof itemSnap.data === 'function') ? itemSnap.data() : itemSnap.data
          inferredTags = itemData?.tags || itemData?.productTags || undefined
          inferredRiskLevel = itemData?.productRiskLevel || itemData?.riskLevel || undefined
          inferredIsImmortal = itemData?.is_immortal || undefined
        }
      } catch (e) {
        // non-fatal, continue without item hints
        console.warn('Failed to read pantry item for hints; falling back to defaults', e)
      }
    }

    const payload = {
      householdId,
      createdBy,
      photoUrl,
      servings,
      notes,
      sourcePantryItemId,
      // Prefer explicit cooked marker from quick-capture UI, otherwise inherit from item
      productMasterTags: isCooked ? ['cooked-rice'] : inferredTags,
      productMasterRiskLevel: isCooked ? 4 : inferredRiskLevel,
      is_immortal: inferredIsImmortal,
      persona: user?.profile?.leftoverPersona || undefined,
    } as any

    try {
      const res = await simpleAddOrMarkLeftover(payload)
        // If user chose to update the linked pantry item's picture, do that now
        if (updateItemPicture && file && sourcePantryItemId) {
          try {
            // uploadLeftoverImage was already called above; photoUrl state updated
              if (photoUrl) {
                const itemRef = DatabaseMonitoringService.doc(`households/${householdId}/inventory`, sourcePantryItemId)
                await DatabaseMonitoringService.updateDoc(itemRef, { image: photoUrl })
              }
          } catch (err) {
            console.warn('Failed to update pantry item image', err)
          }
        }
      setLoading(false)
      onSaved?.(res.id)
      onClose?.()
    } catch (e: any) {
      try {
        const doc = await LeftoverService.createLeftover(payload)
        setLoading(false)
        onSaved?.(doc.id)
        onClose?.()
      } catch (err: any) {
        // If we uploaded an image but fallback creation failed, keep UI informed
        setLoading(false)
        setError(err?.message || 'Save failed')
        console.error('Leftover save failed', err)
      }
    }
  }

  return (
    <div style={{ padding: 12, maxWidth: 520, borderRadius: 8, border: '1px solid #eee' }}>
      <h3 style={{ margin: '4px 0' }}>Save Leftover</h3>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <div style={{ width: 96, height: 72, background: '#f5f5f5', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {photoUrl ? <img src={photoUrl} alt="leftover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: '#888' }}>Photo</span>}
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: 12, color: '#444' }}>Servings</label>
          <input type="number" min={1} value={servings} onChange={(e) => setServings(Number(e.target.value) || 1)} style={{ width: 96, padding: 6 }} />
        </div>
      </div>

      <div style={{ marginBottom: 8 }}>
        <label style={{ display: 'block', fontSize: 12, color: '#444' }}>Photo of container (optional)</label>
        <div style={{ fontSize: 11, color: '#666', marginBottom: 6 }}>A quick photo of the container helps you and your household identify stored leftovers.</div>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const f = e.target.files && e.target.files[0]
            if (f) {
              setFile(f)
              // show temporary preview
              const url = URL.createObjectURL(f)
              setPhotoUrl(url)
            }
          }}
        />
        {sourcePantryItemId && (
          <label style={{ display: 'block', marginTop: 6 }}>
            <input type="checkbox" checked={updateItemPicture} onChange={(e) => setUpdateItemPicture(e.target.checked)} /> Update item's picture with this photo
          </label>
        )}
      </div>

      <div style={{ marginBottom: 8 }}>
        <label style={{ display: 'block', fontSize: 12, color: '#444' }}>Notes (optional)</label>
        <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} style={{ width: '100%', padding: 8 }} />
      </div>

      <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
        <input id="contains-cooked-rice-checkbox" type="checkbox" checked={isCooked} onChange={(e) => setIsCooked(e.target.checked)} />
        <label htmlFor="contains-cooked-rice-checkbox" style={{ fontSize: 13, color: '#333' }}>Contains cooked rice (shorter safety window)</label>
      </div>

      {error && <div style={{ color: 'crimson', marginBottom: 8 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onClose} style={{ padding: '8px 12px' }} disabled={loading}>Cancel</button>
        <button onClick={handleSave} style={{ padding: '8px 12px' }} disabled={loading}>{loading ? 'Saving…' : 'Save'}</button>
      </div>
    </div>
  )
}
