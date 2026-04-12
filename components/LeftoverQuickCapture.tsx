import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { useModalOpen } from '../utils/useModalOpen'
import { useApp } from '../contexts/AppContext'
import { uploadLeftoverImage } from '../services/leftoverImageService'
import { LeftoverService, LeftoverCreateData } from '../services/leftoverService'
import AnalyticsService from '../services/analyticsService'

interface LeftoverQuickCaptureProps {
  createdBy: string
  // Tags inferred by the caller (e.g., recipe/meal context) to apply to the leftover
  initialTags?: string[]
  recipeImageUrl?: string
  initialServings?: number
  initialNotes?: string
  onSaved?: (id: string) => void
  onClose?: () => void
}

export default function LeftoverQuickCapture({
  createdBy,
  initialTags,
  recipeImageUrl,
  initialServings = 1,
  initialNotes = '',
  onSaved,
  onClose
}: LeftoverQuickCaptureProps) {
  useModalOpen()
  const { user, household } = useApp()
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(recipeImageUrl)
  const [file, setFile] = useState<File | null>(null)
  const [servings, setServings] = useState<number>(initialServings)
  const [notes, setNotes] = useState(initialNotes)
  const [isCookedRice, setIsCookedRice] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setLoading(true)
    setError(null)

    try {
      // Upload image if provided
      let uploadedPhotoUrl = photoUrl
      if (file) {
        const uploadTarget = household?.id || user?.id || 'user'
        const scopeToUse: 'household' | 'user' = household?.id ? 'household' : 'user'
        const uploaded = await uploadLeftoverImage(file, uploadTarget, notes || 'leftover', scopeToUse, user?.id)
        uploadedPhotoUrl = uploaded
      }

      // Prepare leftover data
      const leftoverData: LeftoverCreateData = {
        householdId: household?.id || user?.id || '',
        createdBy,
        photoUrl: uploadedPhotoUrl,
        servings,
        notes: notes || undefined,
        tags: initialTags,
        cooked_rice: isCookedRice,
        persona: user?.profile?.leftoverPersona || 'normal',
      }

      // Create the leftover
      const leftover = await LeftoverService.create(leftoverData)

      // Track leftover creation
      AnalyticsService.trackLeftoverCreated(
        household?.id || user?.id || '',
        createdBy,
        servings,
        initialTags
      );

      setLoading(false)
      onSaved?.(leftover.id)
      onClose?.()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setLoading(false)
      setError(err?.message || 'Failed to save leftover')
      console.error('Leftover save failed', err)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] px-4 pt-[var(--safe-area-inset-top,0px)] pb-[var(--safe-area-inset-bottom,0px)]">
      <div className="bg-theme-primary rounded-lg shadow-xl w-full max-w-md mx-auto h-full flex flex-col border border-theme">
        {/* Header */}
        <div className="flex items-center justify-between pt-4 px-3 pb-3 border-b border-theme flex-shrink-0">
          <h3 className="text-lg font-semibold text-theme-primary">Save Leftover</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-theme-secondary rounded transition-colors"
            aria-label="Close"
            data-testid="leftoverquickcapture-close"
          >
            <X className="w-5 h-5 text-theme-primary" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          {/* Image Upload */}
          <div className="pb-2 flex flex-col items-center gap-2">
            <div>
              <img
                src={photoUrl || '/images/placeholder.svg'}
                alt="Leftover container"
                className="w-24 h-24 rounded-lg object-cover border-2 border-theme"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  if (target) target.src = '/images/placeholder.svg'
                }}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="cursor-pointer px-3 py-1 bg-theme-secondary text-theme-primary rounded text-sm hover:bg-theme-primary hover:text-theme-secondary border border-theme">
                Change photo
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) {
                      setFile(f)
                      const url = URL.createObjectURL(f)
                      setPhotoUrl(url)
                    }
                  }}
                  className="hidden"
                  data-testid="leftoverquickcapture-file-input"
                />
              </label>
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-3">
            {/* Servings */}
            <div className="bg-theme-secondary p-2 rounded-lg border border-theme">
              <label className="block text-sm font-medium text-theme-primary mb-1">
                Servings
              </label>
              <input
                type="number"
                min={1}
                value={servings}
                onChange={(e) => setServings(Number(e.target.value) || 1)}
                className="w-full px-2 py-1 text-sm border border-theme rounded-md bg-theme-primary text-theme-primary focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]"
              />
            </div>

            {/* Notes */}
            <div className="bg-theme-secondary p-2 rounded-lg border border-theme">
              <label className="block text-sm font-medium text-theme-primary mb-1">
                Notes (optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g., Chicken stir fry, pasta sauce..."
                className="w-full px-2 py-1 text-sm border border-theme rounded-md bg-theme-primary text-theme-primary focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]"
              />
            </div>

            {/* Cooked Rice Warning */}
            <div className="bg-theme-secondary p-2 rounded-lg border border-theme">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isCookedRice}
                  onChange={(e) => setIsCookedRice(e.target.checked)}
                  className="rounded border-theme"
                />
                <span className="text-sm text-theme-primary">
                  Contains cooked rice (shorter safety window)
                </span>
              </label>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-2">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex-shrink-0 border-t border-theme bg-theme-primary">
          <div className="p-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={onClose}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-theme-secondary text-theme-primary border border-theme rounded-lg hover:bg-theme-primary transition-colors"
                disabled={loading}
                data-testid="leftoverquickcapture-cancel"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-[var(--accent-color)] text-white rounded-lg hover:bg-[var(--accent-color)]/80 transition-colors"
                disabled={loading}
                data-testid="leftoverquickcapture-save"
              >
                {loading ? 'Saving…' : 'Save Leftover'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
