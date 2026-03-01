import React, { useEffect, useState } from 'react'
import { collection, query, orderBy, onSnapshot, where, doc } from 'firebase/firestore'
import { db } from '../firebaseConfig'
import LeftoverService, { Leftover } from '../services/leftoverService'
import FreezerService from '../services/freezerService'
import AnalyticsService from '../services/analyticsService'
import { getExpirationColor } from '../utils/appUtils'
import { useAppActions } from '../contexts/AppActionsContext'
import { useApp } from '../contexts/AppContext'

type Props = {
  householdId: string
}

export default function LeftoversHotZone({ householdId }: Props) {
  const [leftovers, setLeftovers] = useState<Leftover[]>([])
  const { addToast } = useAppActions()

  const app = useApp()

  useEffect(() => {
    if (!householdId) return
    let unsub: (() => void) | null = null

    // Prefer the per-user inventory cache (single-doc read) for cheap Hot Zone reads
    if (app?.user?.id) {
      const cacheRef = doc(db, 'users', app.user.id, 'cache', 'inventory')
      unsub = onSnapshot(cacheRef, snap => {
        if (snap.exists()) {
          const data = snap.data() as any
          const items: any[] = (data.items || []).filter((it: any) => it && it.is_leftover)
          const docs: Leftover[] = items.map((it: any) => ({ id: it.id || it.itemId || Math.random().toString(36).slice(2), ...(it as any) } as Leftover))
          setLeftovers(docs)
        } else {
          // fallback to inventory query
          const q = query(collection(db, 'households', householdId, 'inventory'), where('is_leftover', '==', true), orderBy('leftoverMeta.createdAt', 'desc'))
          const invUnsub = onSnapshot(q, snap2 => {
            const docs: Leftover[] = []
            snap2.forEach(d => docs.push({ id: d.id, ...(d.data() as any) }))
            setLeftovers(docs)
          })
          // replace unsub to ensure we can cleanup invUnsub later
          if (unsub) unsub()
          unsub = invUnsub
        }
      })
    } else {
      // No cache available; query inventory collection for flagged leftovers
      const q = query(collection(db, 'households', householdId, 'inventory'), where('is_leftover', '==', true), orderBy('leftoverMeta.createdAt', 'desc'))
      unsub = onSnapshot(q, snap => {
        const docs: Leftover[] = []
        snap.forEach(d => docs.push({ id: d.id, ...(d.data() as any) }))
        setLeftovers(docs)
      })
    }

    return () => {
      if (unsub) unsub()
    }
  }, [householdId, app?.user?.id])

  if (!leftovers.length) return null

  return (
    <section style={{ padding: 12 }} aria-label="Leftovers Hot Zone">
      <h4 style={{ margin: '4px 0 8px' }}>Leftovers — Hot Zone</h4>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
        {leftovers.map(l => {
          const daysRemaining = Math.ceil((new Date(l.computedBestBefore).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          const color = getExpirationColor(daysRemaining)
          const border = color === 'red' ? '2px solid rgba(248,113,113,0.3)' : color === 'yellow' ? '2px solid rgba(250,204,21,0.25)' : '2px solid rgba(34,197,94,0.16)'
          return (
            <div key={l.id} style={{ minWidth: 220, borderRadius: 8, padding: 8, border, background: '#fff' }}>
              <div style={{ fontWeight: 600 }}>{(l as any).title || 'Leftover'}</div>
              <div style={{ fontSize: 12, color: '#666' }}>{l.servings} servings</div>
              <div style={{ marginTop: 8 }}>
                <div style={{ height: 8, background: '#eee', borderRadius: 4 }}>
                  <div style={{ width: `${Math.max(0, Math.min(100, ((new Date(l.computedBestBefore).getTime() - Date.now()) / (1000*60*60*24)) / 7 * 100))}%`, height: '100%', background: color === 'red' ? '#f87171' : color === 'yellow' ? '#facc15' : '#34d399', borderRadius: 4 }} />
                </div>
                <div style={{ fontSize: 12, marginTop: 6 }}>{daysRemaining} days</div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button
                  aria-label={`Eat one serving from ${l.id}`}
                  onClick={async () => {
                    try {
                      const res = await LeftoverService.consumeLeftover(householdId, l.id)
                      AnalyticsService.logEvent('leftover_consumed', { household_id: householdId, leftover_id: l.id })
                      addToast('Consumed 1 serving', 'success', 5000, 'Undo', async () => {
                        try {
                          if (res && res.previous) {
                            await LeftoverService.restoreLeftover(householdId, l.id, res.previous)
                          }
                        } catch (err) {
                          // ignore
                        }
                      })
                    } catch (err) {
                      addToast('Could not consume leftover', 'error')
                    }
                  }}
                >
                  Eat
                </button>

                <button
                  aria-label={`Move ${l.id} to freezer`}
                  onClick={async () => {
                    try {
                      // If leftover has a sourcePantryItemId try to move inventory; otherwise no-op
                      if ((l as any).sourcePantryItemId) {
                        const result = await FreezerService.moveToFreezer(householdId, (l as any).sourcePantryItemId)
                        AnalyticsService.trackMoveToFreezer(householdId, (l as any).sourcePantryItemId)
                        addToast('Moved to freezer', 'success')
                      } else {
                        addToast('No source item to freeze', 'warning')
                      }
                    } catch (err) {
                      addToast('Failed to move to freezer', 'error')
                    }
                  }}
                >
                  Freeze
                </button>

                <button
                  aria-label={`Discard leftover ${l.id}`}
                  onClick={async () => {
                    try {
                      const res = await LeftoverService.discardLeftover(householdId, l.id)
                      AnalyticsService.logEvent('leftover_discarded', { household_id: householdId, leftover_id: l.id })
                      addToast('Discarded leftover', 'info', 5000, 'Undo', async () => {
                        try {
                          if (res && res.previous) {
                            await LeftoverService.restoreLeftover(householdId, l.id, res.previous)
                          }
                        } catch (err) {
                          // ignore
                        }
                      })
                    } catch (err) {
                      addToast('Could not discard leftover', 'error')
                    }
                  }}
                >
                  Discard
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
