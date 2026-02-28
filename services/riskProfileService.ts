import { doc, setDoc } from 'firebase/firestore'
import { db } from '../firebaseConfig'

export default class RiskProfileService {
  /**
   * Set user's risk level and optionally enable sensitive health mode.
   * Uses setDoc with merge to avoid clobbering existing profile data.
   */
  static async setUserRiskLevel(userId: string, riskLevel: number, sensitiveHealthMode?: boolean) {
    if (!userId) throw new Error('Missing userId')
    const ref = doc(db, 'users', userId)
    const payload: any = { profile: { riskLevel } }
    if (typeof sensitiveHealthMode === 'boolean') payload.profile.sensitiveHealthMode = sensitiveHealthMode
    await setDoc(ref, payload, { merge: true })
  }

  // Pure helper used by UI and tests to map questionnaire answers to a risk level
  static computeRiskLevelFromAnswers(opts: { immunocompromised?: boolean; householdHasInfant?: boolean; householdHasElderly?: boolean; preferStrict?: boolean }) {
    let score = 1
    if (opts.immunocompromised) score += 3
    if (opts.householdHasInfant) score += 1
    if (opts.householdHasElderly) score += 1
    if (opts.preferStrict) score += 1
    return Math.min(5, Math.max(1, score))
  }
}
