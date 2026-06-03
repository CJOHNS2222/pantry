// Lightweight helpers to normalize legacy numeric quantities and new quantity objects
// Use plain `any` here to avoid depending on internal ParsedQuantity shape
export function parseQuantityValue(q: any): { amount: number; unit: string } {
  if (q == null) return { amount: 1, unit: 'count' };
  if (typeof q === 'number') return { amount: q, unit: 'count' };
  if (typeof q === 'string') {
    const n = parseFloat(q as string);
    return { amount: isNaN(n) ? 1 : n, unit: 'count' };
  }
  if (typeof q === 'object') {
    const amount = typeof (q as any).amount === 'number' ? (q as any).amount : 1;
    const unit = (q as any).unit || 'count';
    return { amount, unit };
  }
  return { amount: 1, unit: 'count' };
}

export function getQuantityAmount(q: any): number {
  return parseQuantityValue(q).amount;
}

export function getQuantityUnit(q: any): string {
  return parseQuantityValue(q).unit || 'count';
}
