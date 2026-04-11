/**
 * Zod schemas for validating Firestore document payloads at data-boundary entry points.
 * Use these when reading raw Firestore snapshots to catch schema drift before it
 * propagates through the app as runtime bugs.
 *
 * Usage:
 *   import { PantryItemSchema } from '@/src/schemas/firestoreSchemas';
 *   const item = PantryItemSchema.parse(doc.data());
 *   // or safe (non-throwing):
 *   const result = PantryItemSchema.safeParse(doc.data());
 */

import { z } from 'zod';

// ─── Shared primitives ──────────────────────────────────────────────────────

const isoDateString = z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Expected ISO date string YYYY-MM-DD');
const isoTimestamp  = z.string().datetime({ offset: true }).or(isoDateString);

// ─── Batch ──────────────────────────────────────────────────────────────────

export const BatchSchema = z.object({
  batchId:      z.string(),
  quantity:     z.number(),
  unit:         z.string().optional(),
  expires:      isoDateString.optional(),
  purchaseDate: isoDateString.optional(),
  note:         z.string().optional(),
});

// ─── PantryItem ─────────────────────────────────────────────────────────────

const QuantityObjectSchema = z.object({
  amount:         z.number(),
  unit:           z.string(),
  originalAmount: z.number().optional(),
  originalUnit:   z.string().optional(),
});

export const PantryItemSchema = z.object({
  id:               z.string(),
  item:             z.string().min(1),
  category:         z.string(),
  quantity_estimate: z.string().optional().default(''),
  image:            z.string().url().optional().or(z.literal('')),
  containerImage:   z.string().optional(),
  storageLocation:  z.string().optional(),
  expirationDate:   isoDateString.optional(),
  expiryDate:       isoDateString.optional(),
  expirationType:   z.enum(['use-by', 'best-by']).optional(),
  dateAdded:        isoTimestamp.optional(),
  lastRestocked:    isoTimestamp.optional(),
  consumptionHistory: z.array(isoTimestamp).optional(),
  quantity:         z.union([z.number(), QuantityObjectSchema]).optional(),
  batches:          z.array(BatchSchema).optional(),
  visualLevel:      z.enum(['empty', 'quarter', 'half', 'threeQuarter', 'full']).optional(),
  reservations:     z.array(z.object({
    recipeId:   z.string(),
    recipeName: z.string(),
    quantity:   z.number(),
    unit:       z.string(),
  })).optional(),
  expiryAlertShown:   z.boolean().optional(),
  tags:               z.array(z.string()).optional(),
  productRiskLevel:   z.number().min(1).max(5).optional(),
  is_immortal:        z.boolean().optional(),
  is_leftover:        z.boolean().optional(),
  notes:              z.string().optional(),
  cooked_rice:        z.boolean().optional(),
  is_frozen:          z.boolean().optional(),
  frozenAt:           isoTimestamp.optional(),
  freezerExpiry:      isoDateString.optional(),
  freezerZone:        z.string().optional(),
  freezerLabelPhotoUrl: z.string().optional(),
  freezerPortionCount:  z.number().optional(),
  isOpened:    z.boolean().optional(),
  openedAt:    isoTimestamp.optional(),
  openedExpiry: isoDateString.optional(),
  isStaple:    z.boolean().optional(),
}).passthrough(); // allow unknown fields for forward compatibility

export type PantryItemFromFirestore = z.infer<typeof PantryItemSchema>;

// ─── ShoppingItem ────────────────────────────────────────────────────────────

export const ShoppingItemSchema = z.object({
  id:               z.string(),
  item:             z.string().min(1),
  category:         z.string().optional(),
  quantity_estimate: z.string().optional(),
  quantity:         z.number().optional(),
  unit:             z.string().optional(),
  checked:          z.boolean().optional().default(false),
  addedBy:          z.string().optional(),
  addedAt:          isoTimestamp.optional(),
  completedAt:      isoTimestamp.optional(),
  estimatedPrice:   z.number().optional(),
}).passthrough();

export type ShoppingItemFromFirestore = z.infer<typeof ShoppingItemSchema>;

// ─── SavedRecipe ─────────────────────────────────────────────────────────────

export const SavedRecipeSchema = z.object({
  id:               z.string(),
  title:            z.string().min(1),
  description:      z.string().optional().default(''),
  ingredients:      z.array(z.string()),
  instructions:     z.array(z.string()),
  cookTime:         z.union([z.string(), z.number()]),
  prepTime:         z.union([z.string(), z.number()]).optional(),
  servings:         z.number().optional(),
  dateSaved:        isoTimestamp,
  image:            z.string().optional(),
  userId:           z.string().optional(),
  visibility:       z.enum(['public', 'private']).optional().default('private'),
  tags:             z.array(z.string()).optional(),
}).passthrough();

export type SavedRecipeFromFirestore = z.infer<typeof SavedRecipeSchema>;

// ─── Convenience: safe parse with fallback ────────────────────────────────────

/**
 * Safely parse a Firestore document against a Zod schema.
 * Logs a warning on failure but returns the raw data cast to T — so the app
 * stays functional even when Firestore data doesn't match the schema exactly.
 */
export function safeParseFirestore<T>(
  schema: z.ZodType<T>,
  data: unknown,
  context?: string,
): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    // Dynamic import to avoid circular deps
      import('../../services/logService').then(({ log }) => {
      log.warn(`Firestore schema mismatch${context ? ` [${context}]` : ''}`, {
        errors: result.error.flatten().fieldErrors,
      });
    }).catch(() => {});
    // Return raw data as-is so the app stays functional
    return data as T;
  }
  return result.data;
}
