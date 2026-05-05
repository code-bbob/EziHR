'use client';

import React from 'react';
import { getFormattedDate, getTodayDates } from '@/lib/date-utils';
import { getDateFormatPreference } from '@/hooks/use-date-format';

interface DateDisplayProps {
  dateStr: string; // ISO date string (YYYY-MM-DD) or in format from API
  preference?: 'ad' | 'bs';
  showBoth?: boolean;
  className?: string;
  title?: string;
  format?: 'YYYY-MM-DD' | 'DD-MM-YYYY' | 'MM/DD/YYYY';
}

/**
 * Component to display dates in user's preferred format
 * Shows both AD and BS dates if showBoth is true
 */
export function DateDisplay({
  dateStr,
  preference,
  showBoth = false,
  className = '',
  title,
  format = 'YYYY-MM-DD',
}: DateDisplayProps) {
  const finalPreference = preference || getDateFormatPreference();
  const formatted = getFormattedDate(dateStr, finalPreference);

  if (!formatted) {
    return <span className={className}>{dateStr}</span>;
  }

  if (showBoth) {
    return (
      <span className={className} title={title || `${formatted.ad} (AD) / ${formatted.bs} (BS)`}>
        <span className="font-medium">{formatted.display}</span>
        <span className="text-xs text-muted-foreground ml-1">
          ({finalPreference === 'bs' ? 'BS' : 'AD'})
        </span>
      </span>
    );
  }

  return (
    <span className={className} title={title || `${formatted.ad} (AD) / ${formatted.bs} (BS)`}>
      {formatted.display}
    </span>
  );
}

/**
 * Display current date in both formats
 */
export function TodayDate({ preference }: { preference?: 'ad' | 'bs' }) {
  const today = getTodayDates();
  const finalPreference = preference || getDateFormatPreference();
  const displayDate = finalPreference === 'bs' ? today.bs : today.ad;

  return <span>{displayDate}</span>;
}

/**
 * Badge showing calendar system
 */
export function DateFormatBadge({ format }: { format?: 'ad' | 'bs' }) {
  const finalFormat = format || getDateFormatPreference();
  const label = finalFormat === 'bs' ? 'BS (Nepali)' : 'AD (Gregorian)';
  const bgColor = finalFormat === 'bs' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800';

  return (
    <span className={`inline-block px-2 py-1 text-xs font-semibold rounded ${bgColor}`}>
      {label}
    </span>
  );
}
