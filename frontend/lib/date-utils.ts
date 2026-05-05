/**
 * Date utilities for AD (Gregorian) and BS (Nepali) calendar conversions
 * Mirrors the backend date conversion logic
 */

// Nepali month days lookup table
const NEPALI_MONTH_DAYS: Record<number, number[]> = {
  2000: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2001: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2002: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 31],
  2003: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 31],
  2004: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 31],
  2005: [31, 32, 32, 31, 31, 30, 30, 29, 30, 29, 30, 31],
  2006: [31, 32, 32, 31, 31, 30, 30, 29, 30, 29, 30, 31],
  2007: [31, 32, 32, 31, 31, 31, 29, 30, 29, 30, 30, 31],
  2008: [31, 31, 32, 32, 31, 31, 29, 30, 29, 30, 30, 31],
  2009: [31, 31, 32, 32, 31, 30, 30, 29, 29, 30, 30, 31],
  2010: [31, 31, 32, 31, 31, 30, 30, 29, 30, 29, 30, 31],
  2011: [31, 31, 32, 31, 31, 30, 30, 29, 30, 29, 30, 31],
  2012: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 31],
  2013: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 31],
  2014: [31, 32, 31, 32, 31, 31, 29, 30, 29, 30, 30, 31],
  2015: [31, 32, 32, 31, 31, 31, 29, 30, 29, 30, 30, 31],
  2016: [31, 32, 32, 31, 31, 30, 30, 29, 29, 30, 30, 31],
  2017: [31, 31, 32, 32, 31, 30, 30, 29, 29, 30, 30, 31],
  2018: [31, 31, 32, 32, 31, 31, 29, 30, 29, 30, 30, 31],
  2019: [31, 31, 32, 31, 32, 31, 29, 30, 29, 30, 30, 31],
  2020: [31, 32, 31, 32, 31, 30, 30, 29, 29, 30, 30, 31],
  2021: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 31],
  2022: [31, 32, 32, 31, 31, 30, 30, 29, 30, 29, 30, 31],
  2023: [31, 32, 32, 31, 31, 30, 30, 29, 30, 29, 30, 31],
  2024: [31, 32, 32, 31, 31, 31, 29, 30, 29, 30, 30, 31],
  2025: [31, 32, 32, 31, 31, 31, 29, 30, 29, 30, 30, 31],
  2026: [31, 31, 32, 32, 31, 30, 30, 29, 29, 30, 30, 31],
  2027: [31, 31, 32, 32, 31, 31, 29, 30, 29, 30, 30, 31],
  2028: [31, 31, 32, 31, 32, 31, 29, 30, 29, 30, 30, 31],
  2029: [31, 32, 31, 32, 31, 30, 30, 29, 29, 30, 30, 31],
  2030: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 31],
  2031: [31, 32, 32, 31, 31, 30, 30, 29, 30, 29, 30, 31],
  2032: [31, 32, 32, 31, 31, 31, 29, 30, 29, 30, 30, 31],
  2033: [31, 32, 32, 31, 31, 31, 29, 30, 29, 30, 30, 31],
};

const NEPALI_EPOCH_AD = new Date(1943, 3, 14); // April 14, 1943

export function getNepaliMonthDays(year: number, month: number): number {
  if (NEPALI_MONTH_DAYS[year]) {
    return NEPALI_MONTH_DAYS[year][month - 1] || 30;
  }
  return 30; // Fallback
}

export function adToBS(date: Date): { year: number; month: number; day: number } {
  const deltaMs = date.getTime() - NEPALI_EPOCH_AD.getTime();
  const deltaDays = Math.floor(deltaMs / (1000 * 60 * 60 * 24));

  let nepaliYear = 2000;
  let nepaliMonth = 1;
  let nepaliDay = 1;

  let daysToAdd = deltaDays;

  while (daysToAdd > 0) {
    const daysInMonth = getNepaliMonthDays(nepaliYear, nepaliMonth);
    const daysLeftInMonth = daysInMonth - nepaliDay + 1;

    if (daysToAdd >= daysLeftInMonth) {
      daysToAdd -= daysLeftInMonth;
      nepaliDay = 1;
      nepaliMonth += 1;

      if (nepaliMonth > 12) {
        nepaliMonth = 1;
        nepaliYear += 1;
      }
    } else {
      nepaliDay += daysToAdd;
      daysToAdd = 0;
    }
  }

  return { year: nepaliYear, month: nepaliMonth, day: nepaliDay };
}

export function bsToAD(year: number, month: number, day: number): Date {
  let days = 0;

  // Add days for complete years
  for (let y = 2000; y < year; y++) {
    for (let m = 1; m <= 12; m++) {
      days += getNepaliMonthDays(y, m);
    }
  }

  // Add days for complete months in current year
  for (let m = 1; m < month; m++) {
    days += getNepaliMonthDays(year, m);
  }

  // Add days in current month
  days += day - 1;

  return new Date(NEPALI_EPOCH_AD.getTime() + days * 24 * 60 * 60 * 1000);
}

export function formatADDate(date: Date, format: string = 'YYYY-MM-DD'): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  if (format === 'YYYY-MM-DD') return `${year}-${month}-${day}`;
  if (format === 'DD-MM-YYYY') return `${day}-${month}-${year}`;
  if (format === 'MM/DD/YYYY') return `${month}/${day}/${year}`;
  return `${year}-${month}-${day}`;
}

export function formatBSDate(year: number, month: number, day: number, format: string = 'YYYY-MM-DD'): string {
  const monthStr = String(month).padStart(2, '0');
  const dayStr = String(day).padStart(2, '0');

  if (format === 'YYYY-MM-DD') return `${year}-${monthStr}-${dayStr}`;
  if (format === 'DD-MM-YYYY') return `${dayStr}-${monthStr}-${year}`;
  if (format === 'MM/DD/YYYY') return `${monthStr}/${dayStr}/${year}`;
  return `${year}-${monthStr}-${dayStr}`;
}

export function parseDateString(dateStr: string): { year: number; month: number; day: number } | null {
  const parts = dateStr.replace(/\//g, '-').split('-');
  if (parts.length !== 3) return null;

  try {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);

    if (month < 1 || month > 12 || day < 1 || day > 32) return null;
    return { year, month, day };
  } catch {
    return null;
  }
}

export function getFormattedDate(
  dateStr: string,
  preference: 'ad' | 'bs' = 'ad'
): { display: string; ad: string; bs: string } | null {
  // Parse as ISO date string (YYYY-MM-DD)
  try {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return null;

    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);

    const date = new Date(year, month - 1, day);
    if (isNaN(date.getTime())) return null;

    const adStr = formatADDate(date, 'YYYY-MM-DD');
    const bsData = adToBS(date);
    const bsStr = formatBSDate(bsData.year, bsData.month, bsData.day, 'YYYY-MM-DD');

    return {
      display: preference === 'bs' ? bsStr : adStr,
      ad: adStr,
      bs: bsStr,
    };
  } catch {
    return null;
  }
}

/**
 * Get current date in both formats
 */
export function getTodayDates(): { ad: string; bs: string } {
  const today = new Date();
  const adStr = formatADDate(today, 'YYYY-MM-DD');
  const bsData = adToBS(today);
  const bsStr = formatBSDate(bsData.year, bsData.month, bsData.day, 'YYYY-MM-DD');
  return { ad: adStr, bs: bsStr };
}
