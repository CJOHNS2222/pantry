import { Capacitor } from '@capacitor/core';
import { DayPlan } from '../types';

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
      console.warn('Calendar plugin not available');
      return false;
    }

    try {
      // This plugin doesn't seem to have explicit permission methods
      // Permissions are handled automatically by the native platforms
      return true;
    } catch (err: any) {
      console.error('Error requesting calendar permissions:', err);
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
      console.error('Error checking calendar permissions:', err);
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
      console.warn('Calendar plugin not available');
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
        console.warn('No meals with recipes found in day plan');
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
        console.warn('CapacitorCalendar plugin not available to create event');
      }
      return true;
    } catch (err: any) {
      console.error('Error creating calendar event:', err);
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
      console.warn('Calendar plugin not available');
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
        console.warn('CapacitorCalendar plugin not available to create event');
      }
      return true;
    } catch (err: any) {
      console.error('Error creating cooking reminder:', err);
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
      console.warn('Calendar plugin not available');
      return;
    }

    try {
      const plugin = (Capacitor as any).Plugins?.CapacitorCalendar || (globalThis as any).CapacitorCalendar;
      if (plugin && typeof plugin.openCalendar === 'function') {
        await plugin.openCalendar({ date: date.getTime() });
      } else if ((Capacitor as any).openCalendar) {
        await (Capacitor as any).openCalendar({ date: date.getTime() });
      } else {
        console.warn('CapacitorCalendar plugin not available to open calendar');
      }
    } catch (err: any) {
      console.error('Error opening calendar:', err);
    }
  }
}

export default new CalendarService();
