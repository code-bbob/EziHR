import { adToBS, bsToAD, formatBSDate } from '@/lib/date-utils';

export function escapeCsv(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function buildCsv(rows: Array<Array<unknown>>): string {
  return rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function triggerPrint() {
  window.print();
}

function parseDateParts(dateValue: string) {
  const [year, month, day] = dateValue.split('-').map((part) => Number(part));
  if (![year, month, day].every((part) => Number.isFinite(part))) {
    return null;
  }

  return { year, month, day };
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getRangeDates(startDate: string, endDate: string, dateFormat: 'ad' | 'bs' = 'ad'): string[] {
  const dates: string[] = [];

  let start: Date | null = null;
  let end: Date | null = null;

  if (dateFormat === 'bs') {
    const startParts = parseDateParts(startDate);
    const endParts = parseDateParts(endDate);

    if (!startParts || !endParts) {
      return dates;
    }

    start = bsToAD(startParts.year, startParts.month, startParts.day);
    end = bsToAD(endParts.year, endParts.month, endParts.day);
  } else {
    start = new Date(`${startDate}T00:00:00`);
    end = new Date(`${endDate}T00:00:00`);
  }

  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return dates;
  }

  const current = new Date(start);
  while (current <= end) {
    if (dateFormat === 'bs') {
      const bsDate = adToBS(current);
      const formattedBS = formatBSDate(bsDate.year, bsDate.month, bsDate.day);
      // Ensure we don't exceed the end date in BS format
      if (formattedBS <= endDate) {
        dates.push(formattedBS);
      }
    } else {
      dates.push(formatLocalDate(current));
    }
    current.setDate(current.getDate() + 1);
  }

  // If conversion missed the exact requested endDate (possible when BS conversion
  // rounds to next month for certain years), ensure the requested endDate is
  // included for BS ranges.
  if (dateFormat === 'bs' && dates.length > 0) {
    const last = dates[dates.length - 1];
    if (last !== endDate) {
      // Only append if endDate is after the last generated (to avoid duplicates)
      const lastParts = parseDateParts(last);
      const endParts = parseDateParts(endDate);
      if (lastParts && endParts) {
        const lastNum = lastParts.year * 10000 + lastParts.month * 100 + lastParts.day;
        const endNum = endParts.year * 10000 + endParts.month * 100 + endParts.day;
        if (endNum > lastNum) {
          dates.push(endDate);
        }
      }
    }
  }

  return dates;
}
