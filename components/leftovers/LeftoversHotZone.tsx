import React, { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebaseConfig'
import { LeftoverService } from '../../services/leftoverService'
import { pruneNotificationsForDeletedItems } from '../../services/notificationsService'
import FreezerService from '../../services/freezerService'
import AnalyticsService from '../../services/analyticsService'
import { getExpirationColor } from '../../utils/appUtils'
import { useAppActions } from '../../contexts/AppActionsContext'
import { useApp } from '../../contexts/AppContext'
import { InventoryCacheService } from '../../services/inventoryCacheService'
import { PantryItem } from '../../types'

interface LeftoversHotZoneProps {
  householdId: string;
  onNavigateToRecipes?: (query: string) => void;}

export default function LeftoversHotZone({ householdId, onNavigateToRecipes }: LeftoversHotZoneProps) {
  const [leftovers, setLeftovers] = useState<PantryItem[]>([])
  const { addToast } = useAppActions()
  const { user } = useApp()

  useEffect(() => {
    if (!householdId || !user?.id) return

    // The inventory cache is stored as a single document (not individual docs per item),
    // so we subscribe to the inventory cache doc and filter in memory.
    const cachePath = householdId !== user.id
      ? `households/${householdId}/cache/inventory`
      : `users/${user.id}/cache/inventory`;
    const cacheDocRef = doc(db, cachePath)
    const unsub = onSnapshot(cacheDocRef, snap => {
      if (!snap.exists()) {
        setLeftovers([])
        return
      }
      const data = snap.data() as Record<string, any>
      const items: PantryItem[] = []
      for (const [itemId, itemArray] of Object.entries(data)) {
        if (Array.isArray(itemArray)) {
          try {
            const item = InventoryCacheService.arrayToPantryItem(itemId, itemArray)
            if (item.is_leftover) items.push(item)
          } catch { /* skip malformed entries */ }
        }
      }
      items.sort((a, b) => {
        const aDate = a.leftoverMeta?.createdAt ?? ''
        const bDate = b.leftoverMeta?.createdAt ?? ''
        return bDate.localeCompare(aDate)
      })
      setLeftovers(items)
    })

    return () => {
      unsub()
    }
  }, [householdId, user?.id])

  if (!leftovers.length) return null

  const handleConsume = async (leftover: PantryItem) => {
    try {
      const result = await LeftoverService.consumeServing(householdId, leftover.id)

      const servingsLeft = result.deleted ? 0 : (leftover.leftoverMeta?.servings ?? 1) - 1
      AnalyticsService.trackLeftoverConsumed(householdId, leftover.id, servingsLeft)
      if (result.deleted && user?.id) {
        pruneNotificationsForDeletedItems(user.id, [leftover.id]).catch(() => {})
      }
      addToast(
        servingsLeft > 0 ? `Consumed 1 serving (${servingsLeft} left)` : 'Consumed last serving',
        'success',
        5000,
        servingsLeft === 0 ? undefined : 'Undo',
        servingsLeft === 0 ? undefined : async () => {
          // Note: Undo functionality would need to be implemented
          // For now, just show a message
          addToast('Undo not implemented yet', 'info')
        }
      )
    } catch (err) {
      addToast('Could not consume leftover', 'error')
    }
  }

  const handleFreeze = async (leftover: PantryItem) => {
    try {
      await LeftoverService.moveToFreezer(householdId, leftover.id)
      AnalyticsService.trackMoveToFreezer(householdId, leftover.id)
      addToast('Moved to freezer', 'success')
    } catch (err) {
      addToast('Failed to move to freezer', 'error')
    }
  }

  const handleDiscard = async (leftover: PantryItem) => {
    try {
      await LeftoverService.discard(householdId, leftover.id)
      AnalyticsService.trackLeftoverDiscarded(householdId, leftover.id)
      if (user?.id) {
        pruneNotificationsForDeletedItems(user.id, [leftover.id]).catch(() => {})
      }
      addToast('Discarded leftover', 'info', 5000, 'Undo', async () => {
        // Note: Restore functionality would need to be implemented
        addToast('Undo not implemented yet', 'info')
      })
    } catch (err) {
      addToast('Could not discard leftover', 'error')
    }
  }

  const handleTransformLeftover = async (leftover: PantryItem) => {
    try {
      // Navigate to recipes with a prompt about this leftover
      // This would need to be passed up to the parent component
      // For now, just show a placeholder
      addToast('Leftover transformation coming soon!', 'info');
    } catch (error) {
      addToast('Failed to get transformation ideas', 'error');
    }
  };

  return (
    <section className="px-3 py-2" aria-label="Leftovers Hot Zone">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-theme-primary">🥡 Leftovers</h4>
        <button
          onClick={() => onNavigateToRecipes?.('leftover transformation ideas')}
          className="text-xs px-2 py-1 bg-[var(--accent-color)] text-white rounded hover:bg-[var(--accent-color)]/80 transition-colors"
        >
          Transform Ideas
        </button>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {leftovers.map(leftover => {
          const bestBefore = leftover.expirationDate ? new Date(leftover.expirationDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          const daysRemaining = Math.ceil((bestBefore.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          const color = getExpirationColor(daysRemaining)
          const attentionLevel = LeftoverService.needsAttention(leftover)

          return (
            <div
              key={leftover.id}
              className={`min-w-[200px] bg-theme-secondary rounded-lg p-3 border ${
                attentionLevel === 'urgent' ? 'border-red-300 bg-red-50' :
                attentionLevel === 'warning' ? 'border-yellow-300 bg-yellow-50' :
                attentionLevel === 'freeze' ? 'border-blue-300 bg-blue-50' :
                'border-theme'
              }`}
            >
              {/* Image and Title */}
              <div className="flex items-center gap-2 mb-2">
                <img
                  src={leftover.image || '/images/placeholder.svg'}
                  alt={leftover.item}
                  className="w-8 h-8 rounded object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    if (target) target.src = '/images/placeholder.svg'
                  }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-theme-primary truncate">
                    {leftover.item || 'Leftover'}
                  </div>
                  <div className="text-xs text-theme-secondary">
                    {leftover.leftoverMeta?.servings ?? 1} serving{(leftover.leftoverMeta?.servings ?? 1) !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>

              {/* Expiry Progress */}
              <div className="mb-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-theme-secondary">
                    {daysRemaining > 0 ? `${daysRemaining} days` : 'Expired'}
                  </span>
                  {attentionLevel === 'urgent' && (
                    <span className="text-xs text-red-600 font-medium">⚠️ Urgent</span>
                  )}
                  {attentionLevel === 'freeze' && (
                    <span className="text-xs text-blue-600 font-medium">🧊 Consider freezing</span>
                  )}
                </div>
                <div className="w-full bg-theme-primary/20 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      color === 'red' ? 'bg-red-500' :
                      color === 'yellow' ? 'bg-yellow-500' :
                      'bg-green-500'
                    }`}
                    style={{
                      width: `${Math.max(0, Math.min(100, ((bestBefore.getTime() - Date.now()) / (1000*60*60*24)) / 7 * 100))}%`
                    }}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-3 gap-1">
                <button
                  onClick={() => handleConsume(leftover)}
                  className="px-2 py-1.5 text-xs bg-[var(--accent-color)] text-white rounded hover:bg-[var(--accent-color)]/80 transition-colors"
                  aria-label={`Consume one serving from ${leftover.item}`}
                >
                  Eat
                </button>

                <button
                  onClick={() => handleFreeze(leftover)}
                  className="px-2 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  aria-label={`Move ${leftover.item} to freezer`}
                >
                  Freeze
                </button>

                <button
                  onClick={() => handleDiscard(leftover)}
                  className="px-2 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                  aria-label={`Discard leftover ${leftover.item}`}
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
