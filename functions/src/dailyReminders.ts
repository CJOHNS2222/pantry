import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import { randomUUID } from 'node:crypto';
import admin from 'firebase-admin';

if (!admin.apps?.length) {
  admin.initializeApp();
}

const db = getFirestore();

/**
 * Server-side daily reminders: today's planned meals (prep nudge) and pantry items
 * nearing expiration, folded into a single combined notification per user per day
 * (never more than one push) so users aren't flooded with a separate alert per
 * expiring item. Runs independent of any client being open, writing straight into
 * `users/{uid}/cache/notifications` — the same doc `sendPushNotificationOnWrite`
 * (see sendPushNotification.ts) watches, so a real FCM push follows automatically.
 * Respects each user's `profile.notificationSettings` (enabled flag, per-type toggles,
 * and the expiration lead-time preference).
 */

// ─── Notification settings (mirrors services/notificationService.ts on the client) ──

type ExpirySetting = 'never' | 'urgent' | 'day_before' | 'week_before';

interface NotificationSettings {
  enabled: boolean;
  types: {
    expiration: ExpirySetting;
    system: boolean;
    [key: string]: unknown;
  };
}

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: true,
  types: {
    expiration: 'day_before',
    system: true,
  },
};

// ─── Food risk classification (ported from utils/foodRiskClassification.ts) ─────────
// Kept in sync manually — functions/ is a separate TS project and can't import from
// the app's src tree.

const FOOD_RISK_CATEGORIES: Array<{ riskLevel: number; examples: string[] }> = [
  { riskLevel: 5, examples: ['ground beef', 'ground turkey', 'ground pork', 'hamburger', 'meatloaf', 'fish', 'salmon', 'tuna', 'seafood', 'shellfish', 'shrimp', 'crab', 'lobster'] },
  { riskLevel: 4, examples: ['milk', 'cooked meals', 'leftovers', 'cooked rice', 'cooked pasta', 'cooked chicken', 'cooked beef', 'soups', 'stews', 'casseroles', 'deli meat', 'lunch meat', 'ham', 'turkey slices'] },
  { riskLevel: 3, examples: ['spinach', 'lettuce', 'berries', 'strawberries', 'blueberries', 'raspberries', 'salad greens', 'herbs', 'cilantro', 'parsley', 'basil', 'leafy greens', 'fresh vegetables'] },
  { riskLevel: 2, examples: ['hard cheese', 'cheddar', 'parmesan', 'swiss', 'yogurt', 'greek yogurt', 'sour cream', 'cream cheese', 'cottage cheese', 'buttermilk', 'heavy cream'] },
  { riskLevel: 1, examples: ['bread', 'eggs', 'flour', 'sugar', 'rice', 'pasta', 'cereal', 'oats', 'coffee', 'tea', 'spices', 'condiments', 'oils', 'vinegar'] },
];

function getFoodRiskLevel(itemName: string, category?: string): number {
  const nameLower = itemName.toLowerCase();
  const categoryLower = category?.toLowerCase();

  if (nameLower.includes('cooked rice') || (nameLower.includes('rice') && nameLower.includes('leftover'))) return 4;
  if (nameLower.includes('deli') && (nameLower.includes('meat') || nameLower.includes('ham') || nameLower.includes('turkey'))) return 4;

  for (const cat of FOOD_RISK_CATEGORIES) {
    if (cat.examples.some((ex) => nameLower.includes(ex))) return cat.riskLevel;
    if (categoryLower && cat.examples.some((ex) => categoryLower.includes(ex))) return cat.riskLevel;
  }
  return 2;
}

function summarizeExpiringItems(items: Array<{ itemName: string; daysUntilExpiry: number }>): string {
  const preview = items.slice(0, 3).map((i) => i.itemName).join(', ');
  const remaining = items.length - 3;
  return `${items.length} item${items.length > 1 ? 's' : ''} expiring soon: ${preview}${remaining > 0 ? `, +${remaining} more` : ''}`;
}

// ─── Cache document parsing ──────────────────────────────────────────────────────────

function getInventoryCachePath(householdId?: string, userId?: string): string {
  return householdId ? `households/${householdId}/cache/inventory` : `users/${userId}/cache/inventory`;
}

function getMealPlanCachePath(householdId?: string, userId?: string): string {
  return householdId ? `households/${householdId}/cache/mealPlan` : `users/${userId}/cache/mealPlan`;
}

const INVENTORY_META_KEYS = new Set(['lastUpdated', 'version', 'itemCount', '_foodWaste']);

interface ParsedInventoryItem {
  id: string;
  category: string;
  item: string;
  expirationDate: string;
  batches: Array<{ expires?: string }>;
  is_immortal: boolean;
}

// Mirrors InventoryCacheService.arrayToPantryItem's field order (services/inventoryCacheService.ts)
function parseInventoryItem(itemId: string, arr: string[]): ParsedInventoryItem {
  let batches: Array<{ expires?: string }> = [];
  try {
    batches = arr[12] ? JSON.parse(arr[12]) : [];
  } catch {
    batches = [];
  }
  return {
    id: itemId,
    category: arr[0] || '',
    item: arr[3] || '',
    expirationDate: arr[8] || '',
    batches,
    is_immortal: arr[23] === 'true',
  };
}

function computeExpirationDate(item: ParsedInventoryItem): string {
  if (item.batches.length > 0) {
    const expiries = item.batches.map((b) => b.expires).filter((e): e is string => !!e).sort();
    if (expiries.length > 0) return expiries[0];
  }
  return item.expirationDate;
}

// ─── Notification append (mirrors services/notificationsService.ts's dedupe/prune) ──

interface NotificationPayload {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  actionLabel?: string;
  actionType?: string;
  actionData?: Record<string, unknown>;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  read: boolean;
  createdAt: string;
  dedupeKey?: string;
  expiresAt: string;
}

const MAX_STORED_NOTIFICATIONS = 50;

async function appendNotifications(userId: string, items: NotificationPayload[]): Promise<void> {
  if (items.length === 0) return;
  const ref = db.doc(`users/${userId}/cache/notifications`);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? (snap.data() as { items?: NotificationPayload[] }) : {};
    let existing = Array.isArray(data.items) ? data.items : [];

    const now = new Date();
    existing = existing.filter((n) => {
      if (!n.expiresAt) return true;
      try {
        return new Date(n.expiresAt) > now;
      } catch {
        return true;
      }
    });

    for (const item of items) {
      const idx = item.dedupeKey ? existing.findIndex((n) => n.dedupeKey === item.dedupeKey) : -1;
      if (idx !== -1) {
        existing[idx] = item;
      } else {
        existing.push(item);
      }
    }

    const capped = existing.slice(-MAX_STORED_NOTIFICATIONS);
    tx.set(ref, { items: capped }, { merge: true });
  });
}

// ─── Main per-user reminder logic ────────────────────────────────────────────────────
// Everything a user is due to hear about today — meal prep and expiring items alike —
// is folded into a single notification (single push) instead of one-per-item, so a
// bad pantry day doesn't turn into a flood of separate alerts.

async function getTodaysMealNames(userId: string, householdId: string | undefined, todayString: string): Promise<{ names: string[]; total: number }> {
  const mealPlanSnap = await db.doc(getMealPlanCachePath(householdId, userId)).get();
  if (!mealPlanSnap.exists) return { names: [], total: 0 };

  const dayData = (mealPlanSnap.data() as { days?: Record<string, { breakfast?: any[]; lunch?: any[]; dinner?: any[] }> })?.days?.[todayString];
  if (!dayData) return { names: [], total: 0 };

  const meals = [...(dayData.breakfast || []), ...(dayData.lunch || []), ...(dayData.dinner || [])];
  const names = meals.map((m) => m?.recipe?.title).filter(Boolean);
  return { names, total: meals.length };
}

async function getExpiringItems(
  userId: string,
  householdId: string | undefined,
  expirySetting: ExpirySetting
): Promise<Array<{ itemId: string; itemName: string; daysUntilExpiry: number; riskLevel: number }>> {
  if (expirySetting === 'never') return [];

  const invSnap = await db.doc(getInventoryCachePath(householdId, userId)).get();
  if (!invSnap.exists) return [];

  const data = invSnap.data() as Record<string, unknown>;
  const items = Object.entries(data)
    .filter(([key]) => !INVENTORY_META_KEYS.has(key))
    .map(([id, arr]) => parseInventoryItem(id, arr as string[]));

  // 'urgent' and 'day_before' both mean "only things expiring today/tomorrow" (matches
  // the client's shouldShowNotification gating in services/notificationService.ts).
  const maxDays = expirySetting === 'week_before' ? 7 : 1;

  return items
    .filter((item) => !item.is_immortal)
    .map((item) => {
      const expirationDate = computeExpirationDate(item);
      if (!expirationDate) return null;
      const daysUntilExpiry = Math.ceil((new Date(expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysUntilExpiry > maxDays) return null;

      const riskLevel = getFoodRiskLevel(item.item, item.category);
      // Staples/hardy-fridge items aren't worth a daily nag; produce only when truly imminent.
      if (riskLevel <= 2) return null;
      if (riskLevel === 3 && daysUntilExpiry > 3) return null;

      return { itemId: item.id, itemName: item.item, daysUntilExpiry, riskLevel };
    })
    .filter((c): c is { itemId: string; itemName: string; daysUntilExpiry: number; riskLevel: number } => c !== null)
    // Most urgent first so the summary/preview leads with what matters most.
    .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry)
    .slice(0, 6);
}

/**
 * Builds at most one notification per user per day, combining today's meal-prep
 * nudge and any expiring-item summary into a single message/push.
 */
async function buildDailyDigest(
  userId: string,
  householdId: string | undefined,
  todayString: string,
  settings: NotificationSettings
): Promise<NotificationPayload | null> {
  const [mealInfo, expiringItems] = await Promise.all([
    settings.types.system ? getTodaysMealNames(userId, householdId, todayString) : Promise.resolve({ names: [], total: 0 }),
    getExpiringItems(userId, householdId, settings.types.expiration),
  ]);

  const messageParts: string[] = [];

  if (mealInfo.names.length > 0) {
    const shown = mealInfo.names.slice(0, 3);
    const remaining = mealInfo.total - shown.length;
    messageParts.push(`Prep today: ${shown.join(', ')}${remaining > 0 ? ` +${remaining} more` : ''}`);
  }

  if (expiringItems.length > 0) {
    messageParts.push(summarizeExpiringItems(expiringItems));
  }

  if (messageParts.length === 0) return null;

  const hasUrgentExpiry = expiringItems.some((i) => i.daysUntilExpiry <= 0 || i.riskLevel >= 5);
  const hasHighExpiry = expiringItems.some((i) => i.riskLevel >= 4);
  // Meal-only digest (no expiring items) still gets a 'medium' push — worth a nudge either way.
  const priority: NotificationPayload['priority'] = hasUrgentExpiry ? 'urgent' : hasHighExpiry ? 'high' : 'medium';

  const title = expiringItems.length > 0 && mealInfo.names.length > 0
    ? 'Pantry & Meal Reminder'
    : expiringItems.length > 0
      ? 'Items Expiring Soon'
      : "Today's Meals";

  return {
    id: randomUUID(),
    userId,
    type: expiringItems.length > 0 ? 'expiration' : 'system',
    title,
    message: messageParts.join('. ') + '.',
    actionLabel: expiringItems.length > 0 ? 'View Items' : 'View Meal Plan',
    actionType: 'view_item',
    actionData: {
      tab: mealInfo.names.length > 0 ? 'meals' : 'pantry',
      items: expiringItems.map((i) => ({ itemId: i.itemId, itemName: i.itemName })),
    },
    priority,
    read: false,
    createdAt: new Date().toISOString(),
    // One key per user per day — a second run the same day (e.g. a manual retry)
    // replaces rather than duplicates.
    dedupeKey: `daily_digest_${todayString}`,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

async function runDailyReminders(): Promise<void> {
  logger.info('Starting daily reminders (meal prep + expiring inventory)');

  const usersSnapshot = await db.collection('users').get();
  const todayString = new Date().toISOString().slice(0, 10);

  let usersNotified = 0;
  let errors = 0;

  await Promise.all(usersSnapshot.docs.map(async (userDoc) => {
    const userId = userDoc.id;
    try {
      const userData = userDoc.data() as { isGuest?: boolean; householdId?: string; profile?: { notificationSettings?: NotificationSettings } };
      if (userData.isGuest) return;

      const settings: NotificationSettings = {
        ...DEFAULT_SETTINGS,
        ...userData.profile?.notificationSettings,
        types: { ...DEFAULT_SETTINGS.types, ...userData.profile?.notificationSettings?.types },
      };
      if (!settings.enabled) return;

      const householdId = userData.householdId;
      const digest = await buildDailyDigest(userId, householdId, todayString, settings);

      if (digest) {
        await appendNotifications(userId, [digest]);
        usersNotified++;
      }
    } catch (err) {
      errors++;
      logger.error(`Failed to build daily reminders for user ${userId}:`, err);
    }
  }));

  logger.info(`Daily reminders complete. Notified ${usersNotified} users. Errors: ${errors}`);
}

export const sendDailyReminders = onSchedule(
  {
    // 13:00 UTC ≈ 8am US Eastern / 9am Central — a reasonable single default since
    // per-user timezones aren't tracked anywhere else in the app either.
    schedule: '0 13 * * *',
    timeZone: 'UTC',
    retryCount: 3,
    maxRetrySeconds: 60,
    timeoutSeconds: 540,
    memory: '512MiB',
  },
  runDailyReminders
);
