import { Timestamp, serverTimestamp } from 'firebase/firestore';
import DatabaseMonitoringService from '../services/databaseMonitoringService';
import { DayPlan } from '../types';

export async function saveDayPlan(householdId: string, day: DayPlan) {
  const id = day.date; // 'YYYY-MM-DD'
  const ref = DatabaseMonitoringService.doc(`households/${householdId}/mealPlan`, id);
  await DatabaseMonitoringService.setDoc(ref, {
    date: Timestamp.fromDate(new Date(day.date)),
    breakfast: day.breakfast || [],
    lunch: day.lunch || [],
    dinner: day.dinner || [],
    lastModifiedBy: localStorage.getItem('clientId') || null,
    lastModifiedAt: serverTimestamp()
  });
}
