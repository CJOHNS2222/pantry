import React, { useState } from 'react'
import { Modal } from '../ui/Modal'
import { useApp } from '../../contexts/AppContext'
import { uploadLeftoverImage } from '../../services/leftoverImageService'
import { LeftoverService, LeftoverCreateData } from '../../services/leftoverService'
import AnalyticsService from '../../services/analyticsService'
import { log } from '../../services/logService'

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
    } catch (err) {
      setLoading(false)
      setError(err instanceof Error ? err.message : 'Failed to save leftover')
      log.error('Leftover save failed', { error: err }, 'LeftoverQuickCapture')
    }
  }

  return (
    <Modal isOpen={true} onClose={() => onClose?.()} title="Save Leftover">
      <Modal.Body>
        <div>
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
      </Modal.Body>
      <Modal.Footer align="between">
        <button
          onClick={onClose}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-theme-secondary text-theme-primary border border-theme rounded-lg hover:bg-theme-primary transition-colors"
          disabled={loading}
          data-testid="leftoverquickcapture-cancel"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[var(--accent-color)] text-[var(--accent-text,white)] rounded-lg hover:bg-[var(--accent-color)]/80 transition-colors"
          disabled={loading}
          data-testid="leftoverquickcapture-save"
        >
          {loading ? 'Saving…' : 'Save Leftover'}
        </button>
      </Modal.Footer>
    </Modal>
  )
}
