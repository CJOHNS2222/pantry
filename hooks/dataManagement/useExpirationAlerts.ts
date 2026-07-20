import { useMemo } from 'react';
import { PantryItem } from '../../types';
import { generateExpirationAlerts } from '../../utils/appUtils';

/**
 * Memoized expiration alerts, recomputed only when inventory changes.
 */
export function useExpirationAlerts(inventory: PantryItem[]) {
  return useMemo(() => generateExpirationAlerts(inventory), [inventory]);
}
