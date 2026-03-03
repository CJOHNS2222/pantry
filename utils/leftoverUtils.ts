export function computeBestBeforeISO(
  createdAtISO: string,
  opts?: { productMaster?: { risk_level?: number; tags?: string[] } | null; risk_level?: number; tags?: string[]; cooked_rice?: boolean; persona?: 'relaxed' | 'normal' | 'strict' }
) {
  const DAYS_MS = (days: number) => days * 24 * 60 * 60 * 1000
  const createdAt = new Date(createdAtISO)
  let candidate: Date | null = null
  // clientProvidedBestBeforeISO removed for leftovers; always compute from heuristics

  const rl = opts?.risk_level ?? opts?.productMaster?.risk_level
  if (!candidate && typeof rl === 'number') {
    const days = rl >= 5 ? 2 : rl === 4 ? 4 : rl === 3 ? 7 : rl === 2 ? 14 : 30
    candidate = new Date(createdAt.getTime() + DAYS_MS(days))
  }

  if (!candidate) candidate = new Date(createdAt.getTime() + DAYS_MS(7))

  const persona = opts?.persona || 'normal'
  if (persona === 'strict') {
    const adj = new Date(candidate.getTime() - DAYS_MS(1))
    if (adj.getTime() > createdAt.getTime()) candidate = adj
  } else if (persona === 'relaxed') {
    candidate = new Date(candidate.getTime() + DAYS_MS(1))
  }

  const isCookedRice = Boolean(
    opts?.cooked_rice ||
    opts?.tags?.includes('cooked-rice') ||
    opts?.productMaster?.tags?.includes('cooked-rice')
  )
  if (isCookedRice) {
    const cap = new Date(createdAt.getTime() + DAYS_MS(4))
    if (candidate.getTime() > cap.getTime()) candidate = cap
  }

  return candidate.toISOString()
}

export default { computeBestBeforeISO }
