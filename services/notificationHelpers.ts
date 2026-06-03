import { generateNotificationStackMessage } from '../utils/foodRiskClassification';

export type DangerItem = {
  itemId: string
  itemName: string
  daysUntilExpiry: number
  risk_level?: number
}

export function formatDangerSummary(items: DangerItem[]) {
  // Use the new risk-based notification stack logic
  const riskItems = items.map(item => ({
    itemName: item.itemName,
    daysUntilExpiry: item.daysUntilExpiry,
    riskLevel: item.risk_level || 2,
    itemId: item.itemId
  }));

  const { title, message } = generateNotificationStackMessage(riskItems);

  // Determine priority based on highest risk and soonest expiry
  const highestRisk = items.reduce((acc, it) => Math.max(acc, it.risk_level || 0), 0);
  const soonest = items.reduce((acc, it) => Math.min(acc, it.daysUntilExpiry), Infinity);

  let priority: 'low' | 'medium' | 'high' | 'urgent' = 'low';
  if (soonest <= 0 || highestRisk >= 5) priority = 'urgent';
  else if (soonest === 1 || highestRisk >= 4) priority = 'high';
  else if (soonest <= 3) priority = 'medium';

  return { title, message, priority };
}
