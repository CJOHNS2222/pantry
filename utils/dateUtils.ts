/**
 * Formats a Date as a local (not UTC) YYYY-MM-DD date-only string.
 * Use this instead of `date.toISOString().slice(0, 10)` for any date-only
 * value (expiration dates, "today" boundaries, etc.) — `toISOString()`
 * converts to UTC first, which shifts the calendar day near local midnight
 * for any timezone with a non-zero UTC offset.
 * @param date The date to format (defaults to now)
 * @returns Local date string in 'YYYY-MM-DD' format
 */
export function localDateString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Parses a date-only string (e.g. 'YYYY-MM-DD') as local midnight rather
 * than UTC midnight. `new Date('YYYY-MM-DD')` parses as UTC per the spec,
 * which shifts the represented calendar day backward by a day in any
 * timezone west of UTC — this is the root cause of off-by-one expiry bugs.
 * Falls back to the native `Date` constructor for non-date-only strings
 * (e.g. full ISO timestamps), which should already carry a timezone.
 * @param dateStr A date string, ideally 'YYYY-MM-DD'
 * @returns A Date representing local midnight on that day
 */
export function parseLocalDateString(dateStr: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (match) {
    const [, y, m, d] = match;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  return new Date(dateStr);
}

/**
 * Generates an array of the next 7 date keys in YYYY-MM-DD format
 * @param start The starting date (defaults to today)
 * @returns Array of 7 date strings
 */
export function next7DateKeys(start = new Date()) {
  const keys: string[] = [];
  const d = new Date(start);
  d.setHours(0,0,0,0);
  for (let i = 0; i < 7; i++) {
    const k = d.toISOString().slice(0,10); // 'YYYY-MM-DD'
    keys.push(k);
    d.setDate(d.getDate() + 1);
  }
  return keys;
}
