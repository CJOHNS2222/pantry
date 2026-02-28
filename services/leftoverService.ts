import { collection, doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore'
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
    opts?: { productMaster?: { risk_level?: number; tags?: string[] } | null; clientProvidedBestBeforeISO?: string }
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

    if (payload.productMasterId) {
      try {
        const pmRef = doc(db, 'product_master', payload.productMasterId)
        const pmSnap = await getDoc(pmRef)
        if (pmSnap.exists()) productMaster = pmSnap.data()
      } catch (e) {
        // non-fatal; continue with null productMaster
      }
    }

    // If no product master document found, allow lightweight hints from payload
    if (!productMaster && (payload.productMasterTags || payload.productMasterRiskLevel)) {
      productMaster = {
        tags: payload.productMasterTags || [],
        risk_level: payload.productMasterRiskLevel,
      }
    }

    const computedBestBefore = LeftoverService.computeBestBeforeISO(nowISO, {
      productMaster,
      clientProvidedBestBeforeISO: payload.clientProvidedBestBeforeISO,
    })

    const leftoversCol = collection(db, 'households', payload.householdId, 'leftovers')
    const newRef = doc(leftoversCol)

    const docBody = {
      ...payload,
      createdAt: nowISO,
      computedBestBefore,
      freezerState: payload.tags?.includes('frozen') ? 'frozen' : 'fresh',
      createdAt_serverTs: serverTimestamp(),
    }

    await setDoc(newRef, docBody)

    return { id: newRef.id, ...docBody } as Leftover
  }
}
