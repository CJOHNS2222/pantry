/**
 * repairSubscriptions.ts — Firebase Cloud Function (admin-only, manual)
 *
 * One-shot sweep that repairs contradictory `users/{uid}.subscription` maps.
 *
 * Why this exists: a subscription map can end up self-contradictory (e.g.
 * `tier:'free'` alongside `cancel_at_period_end:true`) because it accretes from
 * partial field-level writes — the creation default in hooks/useAuth.ts, then a
 * later update that only touches two or three fields. No single write produces
 * those states, so they can't be fixed by correcting one writer.
 *
 * The RTDN handler (subscriptionNotifications.ts) already self-heals a user
 * lazily when a Play notification arrives for them, but an account that never
 * receives another notification would stay broken forever. This sweeps them.
 *
 * Play is the source of truth for every repair (see repairSubscriptionDoc):
 * docs with a purchase token are re-verified against Play, docs without one are
 * normalized to a clean free state, and a Play API failure leaves the doc
 * untouched rather than guessing.
 *
 * Usage (from an admin account, in the app or a console):
 *   const fn = httpsCallable(functions, 'repairSubscriptions');
 *   await fn({ dryRun: true });   // report only, writes nothing
 *   await fn({ dryRun: false });  // apply repairs
 */

import {onCall, HttpsError} from "firebase-functions/v2/https";
import {logger} from "firebase-functions/v2";
import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {repairSubscriptionDoc, isInconsistentSubscription} from "./googlePlayHelpers";

if (!getApps().length) {
  initializeApp();
}

// Repairs run sequentially in batches of this size. Each repair that hits Play
// costs one Android Publisher API call, so this bounds burst load on that API
// (and on our own quota) rather than firing hundreds of calls at once.
const BATCH_SIZE = 25;

interface RepairSummary {
  scanned: number;
  inconsistent: number;
  repaired: number;
  failed: number;
  skipped: number;
  dryRun: boolean;
  /** uids left untouched because Play could not be reached — safe to re-run. */
  failedUids: string[];
  /** Present only on a dry run: which uids would be repaired. */
  wouldRepairUids?: string[];
}

export const repairSubscriptions = onCall(
  {enforceAppCheck: false, timeoutSeconds: 540, region: "us-east1"},
  async (request): Promise<RepairSummary> => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const db = getFirestore();

    // Gate on the same `admins/{uid}` marker the client and firestore.rules use.
    // That collection is `allow write: if false`, so it can only be provisioned
    // server-side — a caller cannot grant themselves this.
    const adminSnap = await db.collection("admins").doc(uid).get();
    if (!adminSnap.exists) {
      logger.warn("Non-admin attempted to run repairSubscriptions", {uid});
      throw new HttpsError("permission-denied", "Admin access required.");
    }

    // Default to a dry run: an explicit `dryRun: false` is required to write.
    // A mistyped or missing argument must never mass-mutate user docs.
    const dryRun = (request.data as {dryRun?: unknown} | undefined)?.dryRun !== false;

    const summary: RepairSummary = {
      scanned: 0,
      inconsistent: 0,
      repaired: 0,
      failed: 0,
      skipped: 0,
      dryRun,
      failedUids: [],
    };
    const wouldRepairUids: string[] = [];

    logger.info("repairSubscriptions starting", {invokedBy: uid, dryRun});

    // Page through users rather than loading every doc at once — this collection
    // grows unbounded and a single get() would eventually blow the memory limit.
    let lastDocId: string | null = null;
    for (;;) {
      let query = db.collection("users").orderBy("__name__").limit(BATCH_SIZE);
      if (lastDocId) {
        query = query.startAfter(lastDocId);
      }
      const page = await query.get();
      if (page.empty) break;

      for (const doc of page.docs) {
        summary.scanned++;
        const sub = doc.data()?.subscription;
        if (!isInconsistentSubscription(sub)) continue;

        summary.inconsistent++;

        if (dryRun) {
          wouldRepairUids.push(doc.id);
          continue;
        }

        const result = await repairSubscriptionDoc(db, doc.id);
        if (result === "repaired") {
          summary.repaired++;
        } else if (result === "failed") {
          summary.failed++;
          summary.failedUids.push(doc.id);
        } else {
          // 'ok' or 'skipped' — nothing to do, or not enough info to verify.
          summary.skipped++;
        }
      }

      lastDocId = page.docs[page.docs.length - 1].id;
      if (page.size < BATCH_SIZE) break;
    }

    if (dryRun) {
      summary.wouldRepairUids = wouldRepairUids;
    }

    logger.info("repairSubscriptions finished", {invokedBy: uid, ...summary});
    return summary;
  }
);
