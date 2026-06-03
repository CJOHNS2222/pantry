import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { db } from '../firebaseConfig'

function addMonths(date: Date, months: number) {
  const d = new Date(date.getTime())
  d.setMonth(d.getMonth() + months)
  return d
}

export default class FreezerService {
  /**
   * Move an inventory item to the freezer and set a new expiry date based on product_master defaults.
   * - householdId: household scope
   * - itemId: id of the inventory document under households/{householdId}/inventory/{itemId}
   */
  static async moveToFreezer(
    householdId: string,
    itemId: string,
    opts?: {
      freezerDays?: number
      freezerZone?: string
      freezerLabelPhotoUrl?: string
      freezerPortionCount?: number
    }
  ) {
    const itemRef = doc(db, 'households', householdId, 'inventory', itemId)
    let itemSnap;
    try {
      itemSnap = await getDoc(itemRef)
    } catch (err) {
      throw new Error(`Failed to fetch item for freezer move: ${err instanceof Error ? err.message : String(err)}`)
    }
    if (!itemSnap.exists()) throw new Error('Item not found')
    const item = itemSnap.data() as Record<string, unknown>

    // Prefer any denormalized freezer-life hints on the item itself to avoid product_master lookups.
    let defaultFreezerMonths = 3 // fallback ~90 days
    try {
      if (item.default_freezer_life_months && typeof item.default_freezer_life_months === 'number') {
        defaultFreezerMonths = item.default_freezer_life_months
      } else if (item.default_freezer_life && typeof item.default_freezer_life === 'number') {
        defaultFreezerMonths = Math.max(1, Math.round(item.default_freezer_life / 30))
      }
      // If no denormalized hint present, keep the conservative default; do NOT call product_master.
    } catch {
      // non-fatal; use fallback
    }

    const now = new Date()
    const freezerDays = opts?.freezerDays
    const newExpiry = typeof freezerDays === 'number' && freezerDays > 0
      ? new Date(now.getTime() + freezerDays * 24 * 60 * 60 * 1000)
      : addMonths(now, defaultFreezerMonths)

    const updatePayload: Record<string, unknown> = {
      // canonical fields
      storageLocation: 'freezer',
      expirationDate: newExpiry.toISOString(),
      // legacy compatibility fields
      location: 'freezer',
      is_frozen: true,
      freezerMovedAt: now.toISOString(),
      expiry_date: newExpiry.toISOString()
    }

    if (opts?.freezerZone) {
      updatePayload.freezerZone = opts.freezerZone
    }
    if (opts?.freezerLabelPhotoUrl) {
      updatePayload.freezerLabelPhotoUrl = opts.freezerLabelPhotoUrl
      // Legacy alias used in some clients
      updatePayload.labelPhotoUrl = opts.freezerLabelPhotoUrl
    }
    if (typeof opts?.freezerPortionCount === 'number' && opts.freezerPortionCount > 0) {
      updatePayload.freezerPortionCount = opts.freezerPortionCount
      // Legacy alias used in some clients
      updatePayload.portionCount = opts.freezerPortionCount
    }

    await updateDoc(itemRef, updatePayload)

    return { newExpiry: newExpiry.toISOString(), updates: updatePayload }
  }

  /**
   * Move an item from freezer to fridge and apply a defrost safety window.
   * - cookingToday=true keeps a shorter 1-day window
   * - default window is 3 days
   */
  static async moveToFridgeFromFreezer(
    householdId: string,
    itemId: string,
    opts?: { cookingToday?: boolean; defrostDays?: number }
  ) {
    const itemRef = doc(db, 'households', householdId, 'inventory', itemId)
    let itemSnap;
    try {
      itemSnap = await getDoc(itemRef)
    } catch (err) {
      throw new Error(`Failed to fetch item for defrost: ${err instanceof Error ? err.message : String(err)}`)
    }
    if (!itemSnap.exists()) throw new Error('Item not found')

    const now = new Date()
    const baseDays = opts?.cookingToday ? 1 : (opts?.defrostDays ?? 3)
    const newExpiry = new Date(now.getTime() + baseDays * 24 * 60 * 60 * 1000)

    await updateDoc(itemRef, {
      storageLocation: 'fridge',
      expirationDate: newExpiry.toISOString(),
      location: 'fridge',
      is_frozen: false,
      defrostedAt: now.toISOString(),
      expiry_date: newExpiry.toISOString()
    })

    return { newExpiry: newExpiry.toISOString(), cookingToday: Boolean(opts?.cookingToday) }
  }
}
