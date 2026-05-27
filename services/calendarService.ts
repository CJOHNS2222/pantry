import { Capacitor } from '@capacitor/core';
import { DayPlan } from '../types';
import { log } from './logService';

/**
 * CalendarEvent interface for Capacitor Calendar plugin
 */
interface CalendarEvent {
  id?: string;
  title?: string;
  location?: string;
  notes?: string;
  startDate?: number;
  endDate?: number;
  calendarId?: string;
  allDay?: boolean;
}

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
   * Note: This plugin handles permissions automatically, so this is a placeholder
   * @returns {Promise<boolean>} True if permissions are granted
   */
  async requestPermissions(): Promise<boolean> {
    if (!this.isAvailable()) {
      log.warn('Calendar plugin not available', {}, 'CalendarService');
      return false;
    }

    try {
      // This plugin doesn't seem to have explicit permission methods
      // Permissions are handled automatically by the native platforms
      return true;
    } catch (err: any) {
      log.error('Error requesting calendar permissions', err, 'CalendarService');
      return false;
    }
  }

  /**
   * Check if calendar permissions are granted
   * Note: This plugin handles permissions automatically, so this assumes granted
   * @returns {Promise<boolean>} True if permissions are available
   */
  async checkPermissions(): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      // This plugin doesn't seem to have explicit permission checking
      // We'll assume permissions are granted if the plugin is available
      return true;
    } catch (err: any) {
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
        .map(meal => `${(meal as any).mealType || (meal as any).type}: ${meal.recipe!.title}`)
        .join('\n');

      if (!mealTitles) {
        log.warn('No meals with recipes found in day plan', {}, 'CalendarService');
        return false;
      }

      const event: CalendarEvent = {
        title: `Meal Plan - ${date.toLocaleDateString()}`,
        notes: `Smart Pantry Meal Plan\n\n${mealTitles}\n\nTotal calories: ${(dayPlan as any).totalCalories || 'Not calculated'}`,
        startDate: date.getTime(),
        endDate: new Date(date.getTime() + 24 * 60 * 60 * 1000).getTime(), // Next day
        allDay: true
      };
      // Use plugin via Capacitor Plugins to avoid import/type issues
      const plugin = (Capacitor as any).Plugins?.CapacitorCalendar || (globalThis as any).CapacitorCalendar;
      if (plugin && typeof plugin.createEvent === 'function') {
        await plugin.createEvent(event);
      } else if ((Capacitor as any).createEvent) {
        await (Capacitor as any).createEvent(event);
      } else {
        log.warn('CapacitorCalendar plugin not available to create event', {}, 'CalendarService');
      }
      return true;
    } catch (err: any) {
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

      const event: CalendarEvent = {
        title: `Cook: ${recipeTitle}`,
        notes: `Time to prepare ${recipeTitle} from your Smart Pantry meal plan.`,
        startDate: scheduledTime.getTime(),
        endDate: new Date(scheduledTime.getTime() + 60 * 60 * 1000).getTime(), // 1 hour duration
        allDay: false
      };

      const plugin = (Capacitor as any).Plugins?.CapacitorCalendar || (globalThis as any).CapacitorCalendar;
      if (plugin && typeof plugin.createEvent === 'function') {
        await plugin.createEvent(event);
      } else if ((Capacitor as any).createEvent) {
        await (Capacitor as any).createEvent(event);
      } else {
        log.warn('CapacitorCalendar plugin not available to create event', {}, 'CalendarService');
      }
      return true;
    } catch (err: any) {
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
      const plugin = (Capacitor as any).Plugins?.CapacitorCalendar || (globalThis as any).CapacitorCalendar;
      if (plugin && typeof plugin.openCalendar === 'function') {
        await plugin.openCalendar({ date: date.getTime() });
      } else if ((Capacitor as any).openCalendar) {
        await (Capacitor as any).openCalendar({ date: date.getTime() });
      } else {
        log.warn('CapacitorCalendar plugin not available to open calendar', {}, 'CalendarService');
      }
    } catch (err: any) {
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
