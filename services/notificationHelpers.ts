export type DangerItem = {
  itemId: string
  itemName: string
  daysUntilExpiry: number
  risk_level?: number
}

export function formatDangerSummary(items: DangerItem[]) {
  // Pick highest risk and earliest expiry to drive priority and title
  const highestRisk = items.reduce((acc, it) => Math.max(acc, it.risk_level || 0), 0)
  const soonest = items.reduce((acc, it) => Math.min(acc, it.daysUntilExpiry), Infinity)

  let priority: 'low' | 'medium' | 'high' | 'urgent' = 'low'
  if (soonest <= 0 || highestRisk >= 5) priority = 'urgent'
  else if (soonest === 1 || highestRisk >= 4) priority = 'high'
  else if (soonest <= 3) priority = 'medium'

  const title = priority === 'urgent' ? 'Danger Zone Items' : priority === 'high' ? 'High-Risk Items' : 'Items Nearing Expiry'

  const names = items.map(i => i.itemName)
  const preview = names.slice(0, 3).join(', ')
  const message = items.length === 1
    ? `${preview} expires in ${items[0].daysUntilExpiry} days` 
    : `${items.length} items nearing expiry: ${preview}${items.length > 3 ? ', …' : ''}`

  return { title, message, priority }
}
