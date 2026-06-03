/**
 * Onboarding Milestone Service
 *
 * Tracks user behaviour milestones in localStorage so that feature-discovery
 * tooltips and contextual tips are shown only after the user has reached a
 * meaningful stage in their journey — reducing cognitive overload right after
 * sign-up (audit item #18).
 *
 * Milestones are intentionally small and coarse-grained so they stay easy to
 * reason about without a complex state machine.
 */

const STORAGE_KEY = 'app-onboarding-milestones';

export type OnboardingMilestone =
  | 'onboarding-completed'  // user finished (or skipped) the first-run flow
  | 'first-pantry-item'     // at least one pantry item exists
  | 'first-shopping-item'   // at least one shopping list item exists
  | 'first-meal-planned';   // at least one meal has been added to the plan

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
