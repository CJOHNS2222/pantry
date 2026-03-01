import { collection, doc, setDoc, serverTimestamp, getDoc, updateDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../firebaseConfig'

export type LeftoverCreate = {
  householdId: string
  createdBy: string
  photoUrl?: string
  servings: number
  notes?: string
  sourcePantryItemId?: string
  productMasterId?: string
  // Optional hints when product master is not provided
  productMasterTags?: string[]
  productMasterRiskLevel?: number
  clientProvidedBestBeforeISO?: string
  tags?: string[]
  persona?: 'relaxed' | 'normal' | 'strict'
}

export type Leftover = LeftoverCreate & {
  id: string
  createdAt: string // ISO
  computedBestBefore: string // ISO
  freezerState?: 'fresh' | 'frozen' | 'defrosting'
}

const DAYS_MS = (days: number) => days * 24 * 60 * 60 * 1000

export default class LeftoverService {
  static computeBestBeforeISO(
    createdAtISO: string,
    opts?: { productMaster?: { risk_level?: number; tags?: string[] } | null; clientProvidedBestBeforeISO?: string; persona?: 'relaxed' | 'normal' | 'strict' }
  ) {
    const createdAt = new Date(createdAtISO)
    let candidate: Date | null = null

    if (opts?.clientProvidedBestBeforeISO) {
      candidate = new Date(opts.clientProvidedBestBeforeISO)
    }

    if (!candidate && opts?.productMaster?.risk_level) {
      const rl = opts.productMaster.risk_level
      const days = rl >= 5 ? 2 : rl === 4 ? 4 : rl === 3 ? 7 : rl === 2 ? 14 : 30
      candidate = new Date(createdAt.getTime() + DAYS_MS(days))
    }

    if (!candidate) candidate = new Date(createdAt.getTime() + DAYS_MS(7))

    // Apply user persona adjustments (optional)
    const persona = opts?.persona || 'normal'
    if (persona === 'strict') {
      // Be slightly more conservative: shorten by 1 day where possible
      const adj = new Date(candidate.getTime() - DAYS_MS(1))
      if (adj.getTime() > createdAt.getTime()) candidate = adj
    } else if (persona === 'relaxed') {
      // Allow an extra day of leeway for relaxed users
      candidate = new Date(candidate.getTime() + DAYS_MS(1))
    }

    const isCookedRice = Boolean(opts?.productMaster?.tags?.includes('cooked-rice'))
    if (isCookedRice) {
      const cap = new Date(createdAt.getTime() + DAYS_MS(4))
      if (candidate.getTime() > cap.getTime()) candidate = cap
    }

    return candidate.toISOString()
  }

  static async createLeftover(payload: LeftoverCreate) {
    const nowISO = new Date().toISOString()
    let productMaster: any = null

    // Prefer lightweight hints provided on the payload (denormalized item fields).
    // Do NOT perform a product_master lookup — we avoid extra DB calls per user request.
    if (payload.productMasterTags || payload.productMasterRiskLevel) {
      productMaster = {
        tags: payload.productMasterTags || [],
        risk_level: payload.productMasterRiskLevel,
      }
    }

    const computedBestBefore = LeftoverService.computeBestBeforeISO(nowISO, {
      productMaster,
      clientProvidedBestBeforeISO: payload.clientProvidedBestBeforeISO,
      persona: payload.persona,
    })

    const docBody = {
      ...payload,
      createdAt: nowISO,
      computedBestBefore,
      freezerState: payload.tags?.includes('frozen') ? 'frozen' : 'fresh',
      createdAt_serverTs: serverTimestamp(),
    }

    // If this leftover originates from an existing pantry inventory item, mark that pantry doc
    if (payload.sourcePantryItemId) {
      try {
        const itemRef = doc(db, 'households', payload.householdId, 'inventory', payload.sourcePantryItemId)
        const itemSnap = await getDoc(itemRef)
        if (itemSnap.exists()) {
          const prev = itemSnap.data() as any
          const leftoverMeta = {
            servings: payload.servings,
            createdAt: nowISO,
            computedBestBefore,
            notes: payload.notes || null,
            photoUrl: payload.photoUrl || null,
            createdBy: payload.createdBy || null,
          }
          await updateDoc(itemRef, { is_leftover: true, leftoverMeta })
          return { id: payload.sourcePantryItemId, ...docBody } as Leftover
        }
      } catch (err) {
        // Non-fatal: fall back to creating a dedicated leftover doc
      }
    }

    // If we don't have a source pantry item, create a lightweight inventory doc
    // with `is_leftover` flag so leftovers live on the same inventory collection.
    try {
      const invCol = collection(db, 'households', payload.householdId, 'inventory')
      const newInvRef = doc(invCol)
      const invDoc = {
        item: payload.notes || 'Leftover',
        image: payload.photoUrl || null,
        quantity: payload.servings || 1,
        storageLocation: 'fridge',
        is_leftover: true,
        leftoverMeta: {
          servings: payload.servings,
          createdAt: nowISO,
          computedBestBefore,
          notes: payload.notes || null,
          photoUrl: payload.photoUrl || null,
          createdBy: payload.createdBy || null,
        },
        // Preserve any denormalized safety hints on the inventory doc
        tags: payload.productMasterTags || undefined,
        productRiskLevel: payload.productMasterRiskLevel || undefined,
        is_immortal: (payload as any).is_immortal || undefined,
        createdAt: nowISO,
        createdAt_serverTs: serverTimestamp(),
      }
      await setDoc(newInvRef, invDoc)
      return { id: newInvRef.id, ...docBody } as Leftover
    } catch (err) {
      // Fallback: create a dedicated leftovers doc if inventory write fails
      const leftoversCol = collection(db, 'households', payload.householdId, 'leftovers')
      const newRef = doc(leftoversCol)
      await setDoc(newRef, docBody)
      return { id: newRef.id, ...docBody } as Leftover
    }
  }

  static async consumeLeftover(householdId: string, leftoverId: string) {
    // Try pantry item first (leftover linked to pantry item)
    const itemRef = doc(db, 'households', householdId, 'inventory', leftoverId)
    const itemSnap = await getDoc(itemRef)
    if (itemSnap.exists()) {
      const data = itemSnap.data() as any
      if (!data.is_leftover || !data.leftoverMeta) throw new Error('Not a leftover')
      const previous = { ...data }
      const servings = typeof data.leftoverMeta.servings === 'number' ? data.leftoverMeta.servings : 1
      if (servings > 1) {
        await updateDoc(itemRef, { 'leftoverMeta.servings': servings - 1, 'leftoverMeta.lastConsumedAt': new Date().toISOString() })
        return { previous, deleted: false }
      }
      // last serving consumed — clear leftover flags
      await updateDoc(itemRef, { is_leftover: false, leftoverMeta: null })
      return { previous, deleted: true }
    }

    // Fallback to leftovers collection
    const ref = doc(db, 'households', householdId, 'leftovers', leftoverId)
    const snap = await getDoc(ref)
    if (!snap.exists()) throw new Error('Leftover not found')
    const data = snap.data() as any
    const previous = { ...data }
    const servings = typeof data.servings === 'number' ? data.servings : 1
    if (servings > 1) {
      await updateDoc(ref, { servings: servings - 1, lastConsumedAt: new Date().toISOString() })
      return { previous, deleted: false }
    }
    await deleteDoc(ref)
    return { previous, deleted: true }
  }

  static async discardLeftover(householdId: string, leftoverId: string) {
    // Try pantry item first
    const itemRef = doc(db, 'households', householdId, 'inventory', leftoverId)
    const itemSnap = await getDoc(itemRef)
    if (itemSnap.exists()) {
      const previous = { ...(itemSnap.data() as any) }
      await updateDoc(itemRef, { is_leftover: false, leftoverMeta: null })
      return { previous }
    }

    const ref = doc(db, 'households', householdId, 'leftovers', leftoverId)
    const snap = await getDoc(ref)
    if (!snap.exists()) throw new Error('Leftover not found')
    const previous = { ...(snap.data() as any) }
    await deleteDoc(ref)
    return { previous }
  }

  static async restoreLeftover(householdId: string, leftoverId: string, previous: any) {
    // If previous looks like a pantry item snapshot, restore flags on pantry item
    try {
      const itemRef = doc(db, 'households', householdId, 'inventory', leftoverId)
      const itemSnap = await getDoc(itemRef)
      if (itemSnap.exists()) {
        await updateDoc(itemRef, { is_leftover: true, leftoverMeta: previous.leftoverMeta || { servings: previous.servings || 1, createdAt: previous.createdAt || new Date().toISOString(), computedBestBefore: previous.computedBestBefore } })
        return { id: leftoverId }
      }
    } catch (e) {
      // ignore and fallback
    }

    const ref = doc(db, 'households', householdId, 'leftovers', leftoverId)
    await setDoc(ref, previous)
    return { id: leftoverId }
  }

  // Move an inventory item to the freezer (simple bridge)
  static async moveToFreezer(householdId: string, inventoryId: string, opts?: { freezerDays?: number }) {
    const nowISO = new Date().toISOString()
    const freezerDays = opts?.freezerDays ?? 90 // default ~3 months
    const freezerExpiry = new Date(Date.now() + freezerDays * 24 * 60 * 60 * 1000).toISOString()

    try {
      const itemRef = doc(db, 'households', householdId, 'inventory', inventoryId)
      const itemSnap = await getDoc(itemRef)
      if (!itemSnap.exists()) throw new Error('Inventory item not found')
      await updateDoc(itemRef, {
        storageLocation: 'freezer',
        is_frozen: true,
        frozenAt: nowISO,
        freezerExpiry,
      })
      return { id: inventoryId, freezerExpiry }
    } catch (err) {
      // bubble up
      throw err
    }
  }
}

// Simple client helper: minimal if/else to mark an existing pantry item as leftover
// or create a lightweight inventory doc marked as leftover. Uses LeftoverService helpers.
export async function simpleAddOrMarkLeftover(payload: {
  householdId: string
  createdBy: string
  sourcePantryItemId?: string
  servings?: number
  notes?: string
  photoUrl?: string
  clientProvidedBestBeforeISO?: string
  productMasterRiskLevel?: number
  productMasterTags?: string[]
  persona?: 'relaxed' | 'normal' | 'strict'
}) {
  const nowISO = new Date().toISOString()

  const computedBestBefore = LeftoverService.computeBestBeforeISO(nowISO, {
    productMaster: payload.productMasterTags || payload.productMasterRiskLevel ? { tags: payload.productMasterTags || [], risk_level: payload.productMasterRiskLevel } : undefined,
    clientProvidedBestBeforeISO: payload.clientProvidedBestBeforeISO,
    persona: payload.persona,
  } as any)

  // If linked pantry item exists, mark it
  if (payload.sourcePantryItemId) {
    try {
      const itemRef = doc(db, 'households', payload.householdId, 'inventory', payload.sourcePantryItemId)
      const snap = await getDoc(itemRef)
      if (snap.exists()) {
        const leftoverMeta = {
          servings: payload.servings || 1,
          createdAt: nowISO,
          computedBestBefore,
          notes: payload.notes || null,
          photoUrl: payload.photoUrl || null,
          createdBy: payload.createdBy,
        }
        await updateDoc(itemRef, { is_leftover: true, leftoverMeta })
        return { id: payload.sourcePantryItemId }
      }
    } catch (e) {
      // fall through to create a new inventory doc
    }
  }

  // Create a lightweight inventory doc marked as leftover
  try {
    const invCol = collection(db, 'households', payload.householdId, 'inventory')
    const newRef = doc(invCol)
    const invDoc: any = {
      item: payload.notes || 'Leftover',
      image: payload.photoUrl || null,
      quantity: payload.servings || 1,
      storageLocation: 'fridge',
      is_leftover: true,
      leftoverMeta: {
        servings: payload.servings || 1,
        createdAt: nowISO,
        computedBestBefore,
        notes: payload.notes || null,
        photoUrl: payload.photoUrl || null,
        createdBy: payload.createdBy,
      },
      createdAt: nowISO,
      createdAt_serverTs: serverTimestamp(),
    }
    await setDoc(newRef, invDoc)
    return { id: newRef.id }
  } catch (err) {
    // Last resort: delegate to existing createLeftover which has its own fallback
    return LeftoverService.createLeftover({
      householdId: payload.householdId,
      createdBy: payload.createdBy,
      photoUrl: payload.photoUrl,
      servings: payload.servings || 1,
      notes: payload.notes,
      sourcePantryItemId: payload.sourcePantryItemId,
      clientProvidedBestBeforeISO: payload.clientProvidedBestBeforeISO,
      productMasterRiskLevel: payload.productMasterRiskLevel,
      productMasterTags: payload.productMasterTags,
      persona: payload.persona,
    })
  }
}
