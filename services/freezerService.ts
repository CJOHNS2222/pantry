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
  static async moveToFreezer(householdId: string, itemId: string) {
    const itemRef = doc(db, 'households', householdId, 'inventory', itemId)
    const itemSnap = await getDoc(itemRef)
    if (!itemSnap.exists()) throw new Error('Item not found')
    const item = itemSnap.data() as any

    // Prefer any denormalized freezer-life hints on the item itself to avoid product_master lookups.
    let defaultFreezerMonths = 3 // fallback ~90 days
    try {
      if (item.default_freezer_life_months && typeof item.default_freezer_life_months === 'number') {
        defaultFreezerMonths = item.default_freezer_life_months
      } else if (item.default_freezer_life && typeof item.default_freezer_life === 'number') {
        defaultFreezerMonths = Math.max(1, Math.round(item.default_freezer_life / 30))
      }
      // If no denormalized hint present, keep the conservative default; do NOT call product_master.
    } catch (e) {
      // non-fatal; use fallback
    }

    const now = new Date()
    const newExpiry = addMonths(now, defaultFreezerMonths)

    await updateDoc(itemRef, {
      location: 'freezer',
      is_frozen: true,
      freezerMovedAt: now.toISOString(),
      expiry_date: newExpiry.toISOString()
    })

    return { newExpiry: newExpiry.toISOString() }
  }
}
