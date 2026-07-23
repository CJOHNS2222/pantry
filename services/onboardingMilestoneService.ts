/**
 * Onboarding Milestone Service
 *
 * Tracks user behaviour milestones in localStorage and Firestore so that feature-discovery
 * tooltips and contextual tips are shown only after the user has reached a
 * meaningful stage in their journey — reducing cognitive overload right after
 * sign-up (audit item #18).
 *
 * Milestones are saved both in localStorage (for instant synchronous lookup)
 * and in Firestore under users/{uid}.onboardingMilestones (for cross-device persistence).
 */

const STORAGE_KEY = 'app-onboarding-milestones';

export type OnboardingMilestone =
  | 'onboarding-completed'  // user finished (or skipped) the first-run flow
  | 'first-pantry-item'     // at least one pantry item exists
  | 'pantry-health-visible' // 3+ pantry items exist (PantryHealthScore's render threshold)
  | 'first-shopping-item'   // at least one shopping list item exists
  | 'first-meal-planned'    // at least one meal has been added to the plan
  | 'first-leftover-logged' // at least one leftover has been added
  | 'first-recipe-saved'    // at least one recipe has been saved
  | 'household-setup';      // household has been joined/created

function readMilestones(): Set<OnboardingMilestone> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const arr: OnboardingMilestone[] = raw ? JSON.parse(raw) : [];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

function writeMilestones(milestones: Set<OnboardingMilestone>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...milestones]));
  } catch {
    // localStorage unavailable — gracefully degrade
  }
}

/** Record that the user has reached a milestone (idempotent). */
export function recordMilestone(milestone: OnboardingMilestone): void {
  const milestones = readMilestones();
  if (!milestones.has(milestone)) {
    milestones.add(milestone);
    writeMilestones(milestones);

    // Asynchronously sync the new milestone list to the user's Firestore document
    Promise.resolve().then(async () => {
      try {
        const { getAuth } = await import('firebase/auth');
        const auth = getAuth();
        const uid = auth.currentUser?.uid;
        if (uid) {
          const { default: dbMonitor } = await import('./databaseMonitoringService');
          const userDocRef = dbMonitor.doc('users', uid);
          await dbMonitor.updateDoc(userDocRef, {
            onboardingMilestones: Array.from(milestones)
          });
        }
      } catch {
        // Safe fallback: gracefully degrade in tests or web-only environments
      }
    });
  }
}

/** Returns true if the user has already reached this milestone. */
export function hasMilestone(milestone: OnboardingMilestone): boolean {
  return readMilestones().has(milestone);
}

/** Returns the full set of milestones the user has reached. */
export function getMilestones(): Set<OnboardingMilestone> {
  return readMilestones();
}

/** Synchronizes milestones from Firestore into the local storage set. */
export function syncFromFirestore(firestoreMilestones: string[]): void {
  if (!Array.isArray(firestoreMilestones)) return;
  const milestones = readMilestones();
  let changed = false;

  firestoreMilestones.forEach(m => {
    const milestone = m as OnboardingMilestone;
    if (milestone && !milestones.has(milestone)) {
      milestones.add(milestone);
      changed = true;
    }
  });

  if (changed) {
    writeMilestones(milestones);
  }
}
