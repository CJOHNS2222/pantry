import { Capacitor } from '@capacitor/core';
import { CapacitorCalendar, CalendarPermissionScope } from '@ebarooni/capacitor-calendar';
import { DayPlan } from '../types';
import { log } from './logService';

/**
 * CalendarService provides calendar integration for meal planning and reminders.
 * Supports cross-platform calendar access (iOS/Android) via Capacitor Calendar plugin.
 *
 * Features:
 * - Export meal plans as calendar events
 * - Create cooking reminders
 * - Open calendar at specific dates
 * - Automatic permission handling
 */
class CalendarService {
  /**
   * Check if the Calendar plugin is available on the current platform
   * @returns {boolean} True if calendar plugin is available
   */
  private isAvailable(): boolean {
    return Capacitor.isPluginAvailable('CapacitorCalendar');
  }

  /**
   * Request calendar permissions from the user
   * @returns {Promise<boolean>} True if permissions are granted
   */
  async requestPermissions(): Promise<boolean> {
    if (!this.isAvailable()) {
      log.warn('Calendar plugin not available', {}, 'CalendarService');
      return false;
    }

    try {
      const permission = await CapacitorCalendar.requestFullCalendarAccess();
      return permission.result === 'granted';
    } catch (err: unknown) {
      log.error('Error requesting calendar permissions', err, 'CalendarService');
      return false;
    }
  }

  /**
   * Check if calendar permissions are granted
   * @returns {Promise<boolean>} True if permissions are available
   */
  async checkPermissions(): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const { result } = await CapacitorCalendar.checkAllPermissions();
      return result[CalendarPermissionScope.READ_CALENDAR] === 'granted' && 
             result[CalendarPermissionScope.WRITE_CALENDAR] === 'granted';
    } catch (err: unknown) {
      log.error('Error checking calendar permissions', err, 'CalendarService');
      return false;
    }
  }

  /**
   * Create a calendar event for a meal plan day
   * @param {DayPlan} dayPlan - The meal plan for the day
   * @param {Date} date - The date for the meal plan
   * @returns {Promise<boolean>} True if event was created successfully
   */
  async createMealPlanEvent(dayPlan: DayPlan, date: Date): Promise<boolean> {
    if (!this.isAvailable()) {
      log.warn('Calendar plugin not available', {}, 'CalendarService');
      return false;
    }

    try {
      const hasPermission = await this.checkPermissions();
      if (!hasPermission) {
        const granted = await this.requestPermissions();
        if (!granted) {
          return false;
        }
      }

      const mealTitles = (dayPlan.meals || [])
        .filter(meal => meal.recipe)
        .map(meal => `${(meal as any).mealType || (meal as any).type || 'Meal'}: ${meal.recipe!.title}`)
        .join('\n');

      if (!mealTitles) {
        log.warn('No meals with recipes found in day plan', {}, 'CalendarService');
        return false;
      }

      await CapacitorCalendar.createEvent({
        title: `Meal Plan - ${date.toLocaleDateString()}`,
        description: `Smart Pantry Meal Plan\n\n${mealTitles}\n\nTotal calories: ${(dayPlan as any).totalCalories || 'Not calculated'}`,
        startDate: date.getTime(),
        endDate: new Date(date.getTime() + 24 * 60 * 60 * 1000).getTime(), // Next day
        isAllDay: true
      });
      return true;
    } catch (err: unknown) {
      log.error('Error creating calendar event', err, 'CalendarService');
      return false;
    }
  }

  /**
   * Create a cooking reminder event in the calendar
   * @param {string} recipeTitle - The title of the recipe to remind about
   * @param {Date} scheduledTime - When the cooking should start
   * @returns {Promise<boolean>} True if reminder was created successfully
   */
  async createCookingReminder(recipeTitle: string, scheduledTime: Date): Promise<boolean> {
    if (!this.isAvailable()) {
      log.warn('Calendar plugin not available', {}, 'CalendarService');
      return false;
    }

    try {
      const hasPermission = await this.checkPermissions();
      if (!hasPermission) {
        const granted = await this.requestPermissions();
        if (!granted) {
          return false;
        }
      }

      await CapacitorCalendar.createEvent({
        title: `Cook: ${recipeTitle}`,
        description: `Time to prepare ${recipeTitle} from your Smart Pantry meal plan.`,
        startDate: scheduledTime.getTime(),
        endDate: new Date(scheduledTime.getTime() + 60 * 60 * 1000).getTime(), // 1 hour duration
        isAllDay: false
      });
      return true;
    } catch (err: unknown) {
      log.error('Error creating cooking reminder', err, 'CalendarService');
      return false;
    }
  }

  /**
   * Open the device's calendar app at a specific date
   * @param {Date} date - The date to open the calendar to
   * @returns {Promise<void>}
   */
  async openCalendarAtDate(date: Date): Promise<void> {
    if (!this.isAvailable()) {
      log.warn('Calendar plugin not available', {}, 'CalendarService');
      return;
    }

    try {
      await CapacitorCalendar.openCalendar({ date: date.getTime() });
    } catch (err: unknown) {
      log.error('Error opening calendar', err, 'CalendarService');
    }
  }

  /**
   * Export a week of meal plans as an ICS file (web) or native calendar events (mobile).
   * @param {DayPlan[]} days - Array of DayPlan objects to export
   * @returns {Promise<void>}
   */
  async exportWeekAsICS(days: DayPlan[]): Promise<void> {
    const platform = Capacitor.getPlatform();

    if (platform !== 'web' && this.isAvailable()) {
      // Mobile: create native calendar events
      for (const day of days) {
        const allMeals = [
          ...(day.breakfast || []),
          ...(day.lunch || []),
          ...(day.dinner || []),
          ...(day.meals || []),
        ];
        if (allMeals.length === 0) continue;
        const date = new Date(day.date + 'T12:00:00');
        await this.createMealPlanEvent(day, date);
      }
      return;
    }

    // Web: generate and download an ICS file
    const escape = (str: string) =>
      str.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

    const lines: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Stock & Spoon//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
    ];

    for (const day of days) {
      const allMeals = [
        ...(day.breakfast || []).map(m => ({ type: 'Breakfast', ...m })),
        ...(day.lunch || []).map(m => ({ type: 'Lunch', ...m })),
        ...(day.dinner || []).map(m => ({ type: 'Dinner', ...m })),
        ...(day.meals || []).map(m => ({ type: (m as any).mealType || 'Meal', ...m })),
      ];
      if (allMeals.length === 0) continue;

      // Format date as YYYYMMDD (ICS all-day format)
      const dateStr = day.date.replace(/-/g, '');
      const nextDate = new Date(day.date + 'T00:00:00');
      nextDate.setDate(nextDate.getDate() + 1);
      const nextDateStr = nextDate.toISOString().slice(0, 10).replace(/-/g, '');

      const description = allMeals
        .map(m => `${m.type}: ${m.recipe?.title || 'Unknown'}`)
        .join('\\n');

      const uid = `stockandspoon-${day.date}-${Math.random().toString(36).substr(2, 6)}@stockandspoon.app`;

      lines.push(
        'BEGIN:VEVENT',
        `DTSTART;VALUE=DATE:${dateStr}`,
        `DTEND;VALUE=DATE:${nextDateStr}`,
        `SUMMARY:${escape('Meal Plan – ' + day.dayName)}`,
        `DESCRIPTION:${escape(description)}`,
        `UID:${uid}`,
        'END:VEVENT',
      );
    }

    lines.push('END:VCALENDAR');

    const icsContent = lines.join('\r\n');
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'meal-plan.ics';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

export default new CalendarService();
