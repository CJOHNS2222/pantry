import { serverTimestamp } from 'firebase/firestore'
import { InventoryCacheService } from './inventoryCacheService'
import { PantryItem, LeftoverMeta } from '../types'
import { computeBestBeforeISO } from '../utils/leftoverUtils'
import AnalyticsService from './analyticsService'

export interface LeftoverCreateData {
  householdId: string
  createdBy: string
  photoUrl?: string
  servings: number
  notes?: string
  productMasterId?: string
  // Denormalized cooked-rice boolean for safety checks
  cooked_rice?: boolean
  // Optional hints when product master is not provided
  productMasterTags?: string[]
  productMasterRiskLevel?: number
  // Tags for categorization
  tags?: string[]
  persona?: 'relaxed' | 'normal' | 'strict'
}

export interface Leftover extends LeftoverCreateData {
  id: string
  createdAt: string // ISO
  computedBestBefore: string // ISO
  freezerState?: 'fresh' | 'frozen' | 'defrosting'
}

export class LeftoverService {
  /**
   * Create a new leftover item and store it in the inventory cache
   */
  static async create(data: LeftoverCreateData): Promise<Leftover> {
    const nowISO = new Date().toISOString()

    // Compute the best-before date using the utility function
    const computedBestBefore = computeBestBeforeISO(nowISO, {
      risk_level: data.productMasterRiskLevel,
      tags: data.tags || data.productMasterTags,
      cooked_rice: data.cooked_rice,
      persona: data.persona,
    })

    // Create the leftover metadata
    const leftoverMeta: LeftoverMeta = {
      createdAt: nowISO,
      createdBy: data.createdBy,
      computedBestBefore,
      servings: data.servings,
      riskLevel: data.productMasterRiskLevel,
      notes: data.notes,
    }

    // Create a PantryItem representation for storage in the cache
    const pantryItem: PantryItem = {
      id: crypto.randomUUID(),
      category: 'Leftovers',
      item: data.notes || 'Leftover',
      quantity_estimate: String(data.servings),
      storageLocation: 'fridge',
      expirationDate: computedBestBefore,
      dateAdded: nowISO,
      lastRestocked: nowISO,
      is_leftover: true,
      leftoverMeta,
      image: data.photoUrl || '',
    }

    // Store in the appropriate cache (household or user)
    const useUserCache = data.householdId === data.createdBy
    if (useUserCache) {
      await InventoryCacheService.addItemToCache(pantryItem, undefined, data.householdId)
    } else {
      await InventoryCacheService.addItemToCache(pantryItem, data.householdId, undefined)
    }

    // Track analytics
    AnalyticsService.trackLeftoverCreated(data.householdId, data.createdBy, data.servings, data.tags)

    return {
      ...data,
      id: pantryItem.id,
      createdAt: nowISO,
      computedBestBefore,
      freezerState: 'fresh',
    }
  }

  /**
   * Consume one serving from a leftover item
   */
  static async consumeServing(householdId: string, leftoverId: string): Promise<{ previous: PantryItem; deleted: boolean }> {
    const cached = await InventoryCacheService.getCachedInventory(householdId)
    const found = cached.find(item => item.id === leftoverId)

    if (!found) {
      throw new Error('Leftover not found')
    }

    const currentServings = found.leftoverMeta?.servings ?? 1

    if (currentServings > 1) {
      // Decrement servings
      const updates: Partial<PantryItem> = {
        leftoverMeta: {
          ...found.leftoverMeta,
          servings: currentServings - 1,
          lastConsumedAt: new Date().toISOString(),
        }
      }
      await InventoryCacheService.updateItemInCache(leftoverId, updates, householdId)
      return { previous: found, deleted: false }
    } else {
      // Last serving - remove the item
      await InventoryCacheService.removeItemFromCache(leftoverId, householdId)
      return { previous: found, deleted: true }
    }
  }

  /**
   * Discard a leftover item completely
   */
  static async discard(householdId: string, leftoverId: string): Promise<{ previous: PantryItem }> {
    const cached = await InventoryCacheService.getCachedInventory(householdId)
    const found = cached.find(item => item.id === leftoverId)

    if (!found) {
      throw new Error('Leftover not found')
    }

    await InventoryCacheService.removeItemFromCache(leftoverId, householdId)
    return { previous: found }
  }

  /**
   * Move a leftover to the freezer for long-term storage
   */
  static async moveToFreezer(householdId: string, leftoverId: string, freezerDays: number = 90): Promise<{ freezerExpiry: string }> {
    const freezerExpiry = new Date(Date.now() + freezerDays * 24 * 60 * 60 * 1000).toISOString()

    await InventoryCacheService.updateItemInCache(leftoverId, {
      storageLocation: 'freezer',
      is_frozen: true,
      frozenAt: new Date().toISOString(),
      freezerExpiry,
    }, householdId)

    return { freezerExpiry }
  }

  /**
   * Get all leftover items for a household or user
   */
  static async getLeftovers(householdId?: string, userId?: string): Promise<PantryItem[]> {
    const inventory = await InventoryCacheService.getCachedInventory(householdId, userId)
    return inventory.filter(item => item.is_leftover)
  }

  /**
   * Check if a leftover needs attention (expiring soon or needs freezer)
   */
  static needsAttention(leftover: PantryItem): 'urgent' | 'warning' | 'freeze' | 'none' {
    const bestBefore = leftover.expirationDate ? new Date(leftover.expirationDate) : null
    if (!bestBefore) return 'none'

    const now = new Date()
    const daysUntilExpiry = Math.ceil((bestBefore.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    if (daysUntilExpiry <= 0) return 'urgent' // Expired
    if (daysUntilExpiry <= 2) return 'warning' // Expiring soon
    if (daysUntilExpiry <= 4) return 'freeze' // Consider freezing

    return 'none'
  }
}
