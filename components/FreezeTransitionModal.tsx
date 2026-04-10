import React, { useState } from 'react'
import { Snowflake, X } from 'lucide-react'
import FreezerService from '../services/freezerService'
import { getFreezerShelfLifeDays } from '../utils/appUtils'

type Props = {
  householdId: string
  inventoryId: string
  itemName?: string
  onDone?: (res?: unknown) => void
  onClose?: () => void
}

export default function FreezeTransitionModal({ householdId, inventoryId, itemName, onDone, onClose }: Props) {
  const defaultDays = itemName ? getFreezerShelfLifeDays(itemName) : 120
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [freezerDays, setFreezerDays] = useState<number>(defaultDays)
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
    } catch (e: unknown) {
      setLoading(false)
      setError(e instanceof Error ? e.message : 'Failed to move to freezer')
    }
  }

  return (
    <div className="p-5 w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Snowflake className="w-5 h-5 text-blue-400" />
          <h3 className="text-base font-semibold text-theme-primary">Move to Freezer</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-theme-secondary hover:bg-theme-secondary transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <p className="text-sm text-theme-secondary mb-4">
        Set the freezer shelf life and optional storage details.
        {itemName && (
          <span className="block mt-1 text-blue-400 font-medium">
            USDA default for "{itemName}": {defaultDays} days
          </span>
        )}
      </p>

      {/* Days */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-theme-secondary mb-1">
          Days in freezer
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={7}
            value={freezerDays}
            onChange={e => setFreezerDays(Number(e.target.value) || defaultDays)}
            className="w-28 px-3 py-2 rounded-lg bg-theme-secondary border border-theme text-theme-primary text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <span className="text-sm text-theme-secondary">days</span>
        </div>
      </div>

      {/* Zone */}
      <div className="mb-4">
        <label htmlFor="freezer-zone" className="block text-xs font-medium text-theme-secondary mb-1">
          Freezer zone
        </label>
        <select
          id="freezer-zone"
          value={freezerZone}
          onChange={e => setFreezerZone(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-theme-secondary border border-theme text-theme-primary text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="top">Top shelf</option>
          <option value="middle">Middle shelf</option>
          <option value="bottom">Bottom shelf</option>
          <option value="door">Door</option>
          <option value="drawer">Drawer / bin</option>
          <option value="other">Other</option>
        </select>
      </div>

      {/* Portion count */}
      <div className="mb-4">
        <label htmlFor="freezer-portion" className="block text-xs font-medium text-theme-secondary mb-1">
          Portion count
        </label>
        <input
          id="freezer-portion"
          type="number"
          min={1}
          value={freezerPortionCount}
          onChange={e => setFreezerPortionCount(Number(e.target.value) || 1)}
          className="w-full px-3 py-2 rounded-lg bg-theme-secondary border border-theme text-theme-primary text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      {/* Label photo URL */}
      <div className="mb-4">
        <label htmlFor="freezer-label" className="block text-xs font-medium text-theme-secondary mb-1">
          Label photo URL <span className="text-theme-muted">(optional)</span>
        </label>
        <input
          id="freezer-label"
          type="url"
          value={freezerLabelPhotoUrl}
          onChange={e => setFreezerLabelPhotoUrl(e.target.value)}
          placeholder="https://..."
          className="w-full px-3 py-2 rounded-lg bg-theme-secondary border border-theme text-theme-primary text-sm placeholder-theme-muted focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      {/* Error */}
      {error && (
        <p className="mb-3 text-sm text-red-500 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
      )}

      {/* Actions */}
      <div className="flex gap-2 justify-end">
        <button
          onClick={onClose}
          disabled={loading}
          className="px-4 py-2 rounded-lg text-sm text-theme-secondary hover:bg-theme-secondary transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          disabled={loading}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white transition-colors disabled:opacity-50 flex items-center gap-1"
        >
          <Snowflake className="w-3.5 h-3.5" />
          {loading ? 'Moving…' : 'Move to Freezer'}
        </button>
      </div>
    </div>
  )
}
